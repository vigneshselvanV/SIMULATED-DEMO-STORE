/**
 * orderTools.js
 * Programmatic internal tools for order inspection, listing, cancellation, and admin status updates.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const orderTools = {
  /**
   * Retrieve an order by ID or order number with ownership verification.
   */
  async getOrder({ orderId, orderNumber }, context = {}) {
    if (!orderId && !orderNumber) {
      throw new Error('Either orderId or orderNumber must be provided.');
    }

    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? OR order_number = ?
    `).get(orderId || null, orderNumber || null);

    if (!order) {
      throw new Error('Order not found.');
    }

    // Ownership check
    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view this order.');
    }

    const items = db.prepare(`
      SELECT id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
      FROM order_items WHERE order_id = ?
    `).all(order.id);

    return {
      id: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      shippingAddress: `${order.shipping_address}, ${order.city}, ${order.state} - ${order.postal_code}`,
      subtotalPaise: order.subtotal_paise,
      shippingPaise: order.shipping_paise,
      totalPaise: order.total_paise,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      trackingNumber: order.tracking_number,
      createdAt: order.created_at,
      items
    };
  },

  /**
   * List orders belonging strictly to the authenticated user.
   */
  async listMyOrders({ limit = 10, status = null } = {}, context = {}) {
    const userId = context.userId;
    if (!userId) {
      throw new Error('Authentication required to list customer orders.');
    }

    const conditions = ['user_id = ?'];
    const params = [userId];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const orders = db.prepare(`
      SELECT id, order_number, subtotal_paise, shipping_paise, total_paise, status, payment_status, tracking_number, created_at,
        (SELECT count(*) FROM order_items oi WHERE oi.order_id = orders.id) as items_count
      FROM orders
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params, safeLimit);

    return {
      total: orders.length,
      orders
    };
  },

  /**
   * Cancel an eligible order (Pending or Processing) and restore inventory atomically.
   */
  async cancelEligibleOrder({ orderId, orderNumber, reason = 'Customer requested cancellation' }, context = {}) {
    if (!orderId && !orderNumber) {
      throw new Error('Either orderId or orderNumber is required to cancel an order.');
    }

    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? OR order_number = ?
    `).get(orderId || null, orderNumber || null);

    if (!order) {
      throw new Error('Order not found.');
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to cancel this order.');
    }

    if (order.status === 'Cancelled') {
      return { success: true, message: `Order ${order.order_number} is already cancelled.` };
    }

    const eligibleStatuses = ['Pending', 'Processing'];
    if (!eligibleStatuses.includes(order.status)) {
      throw new Error(
        `Cannot cancel order with status "${order.status}". Orders that are Shipped or Delivered must be returned instead.`
      );
    }

    const cancelTransaction = db.transaction(() => {
      // 1. Restore product inventory
      const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(order.id);
      for (const item of items) {
        db.prepare(`
          UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(item.quantity, item.product_id);
      }

      // 2. Mark order status
      db.prepare(`
        UPDATE orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(order.id);

      // 3. Mark payment as refunded in payments table if recorded
      db.prepare(`
        UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
      `).run(order.id);
    });

    cancelTransaction();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : (context.agentName ? 'agent' : 'customer'),
        actorId: String(context.userId || context.agentName),
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: String(order.id),
        beforeState: { status: order.status },
        afterState: { status: 'Cancelled', reason },
        agentName: context.agentName || null,
        metadata: { reason }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      orderNumber: order.order_number,
      previousStatus: order.status,
      newStatus: 'Cancelled',
      inventoryRestored: true,
      message: `Order ${order.order_number} has been cancelled and stock returned to inventory.`
    };
  },

  /**
   * Update order status (Admin only).
   */
  async updateStatus({ orderId, status, notes = '' }, context = {}) {
    if (context.role !== 'admin') {
      throw new Error('Forbidden: updateStatus requires administrator privileges.');
    }

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: "${status}". Valid options: ${validStatuses.join(', ')}`);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      return orderTools.cancelEligibleOrder({ orderId }, context);
    }

    db.prepare(`
      UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, orderId);

    try {
      auditLogger.log({
        actorType: 'admin',
        actorId: String(context.userId || 'admin'),
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'ORDER',
        entityId: String(orderId),
        beforeState: { status: order.status },
        afterState: { status, notes },
        agentName: context.agentName || null
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      orderId,
      orderNumber: order.order_number,
      previousStatus: order.status,
      newStatus: status,
      notes
    };
  },

  /**
   * Standard AgentGuard tool: update_order
   * Modifies shipping address, order status, or notes on an order record.
   */
  async update_order({ orderId, shippingAddress = null, status = null, notes = null } = {}, context = {}) {
    if (!orderId) {
      throw new Error('Order ID is required to update order.');
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const updates = [];
    const params = [];
    const beforeState = { shippingAddress: order.shipping_address, status: order.status };

    if (shippingAddress) {
      updates.push('shipping_address = ?');
      params.push(shippingAddress);
    }

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return { success: true, message: 'No fields provided to update.', orderId: order.id };
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(order.id);

    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'system'),
        action: 'ORDER_UPDATED',
        entityType: 'ORDER',
        entityId: String(orderId),
        beforeState,
        afterState: { shippingAddress: shippingAddress || order.shipping_address, status: status || order.status, notes },
        agentName: context.agentName || null
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      shippingAddress: shippingAddress || order.shipping_address,
      status: status || order.status,
      notes
    };
  }
};

export default orderTools;
