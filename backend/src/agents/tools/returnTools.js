/**
 * returnTools.js
 * Programmatic internal tools for return eligibility validation, return request creation,
 * status lookup, and return receipt / restocking workflows.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const returnTools = {
  /**
   * Check if an order item is eligible for return within policy window (default 30 days).
   */
  async checkReturnEligibility({ orderId, orderNumber, productId, returnWindowDays = 30 } = {}, context = {}) {
    if (!orderId && !orderNumber) {
      throw new Error('Either orderId or orderNumber must be provided.');
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
      throw new Error('Forbidden: You do not have permission to check returns for this order.');
    }

    // Only Delivered orders can be returned
    if (order.status !== 'Delivered') {
      return {
        eligible: false,
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.status,
        reason: `Orders with status "${order.status}" cannot be returned. Only delivered orders are eligible for return.`
      };
    }

    // Check delivery time window
    const shipment = db.prepare('SELECT delivered_at FROM shipments WHERE order_id = ?').get(order.id);
    const referenceDate = shipment?.delivered_at ? new Date(shipment.delivered_at) : new Date(order.created_at);
    const daysSince = Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > returnWindowDays) {
      return {
        eligible: false,
        orderId: order.id,
        orderNumber: order.order_number,
        daysSinceOrder: daysSince,
        returnWindowDays,
        reason: `Return window expired. The policy allows returns up to ${returnWindowDays} days after delivery (delivered ${daysSince} days ago).`
      };
    }

    // Check specific product or all order items
    let items = [];
    if (productId) {
      const item = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?').get(order.id, productId);
      if (!item) {
        throw new Error(`Product #${productId} was not found in order #${order.order_number}.`);
      }
      items = [item];
    } else {
      items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    }

    const itemEligibility = items.map((item) => {
      const existingReturns = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as returned_qty
        FROM returns
        WHERE order_id = ? AND product_id = ? AND status NOT IN ('rejected', 'cancelled')
      `).get(order.id, item.product_id);

      const returnedQty = existingReturns.returned_qty || 0;
      const remainingReturnable = Math.max(0, item.quantity - returnedQty);

      return {
        productId: item.product_id,
        productName: item.product_name,
        orderedQuantity: item.quantity,
        alreadyReturnedQuantity: returnedQty,
        availableToReturn: remainingReturnable,
        eligible: remainingReturnable > 0
      };
    });

    const anyEligible = itemEligibility.some((i) => i.eligible);

    return {
      eligible: anyEligible,
      orderId: order.id,
      orderNumber: order.order_number,
      daysSinceDelivery: daysSince,
      returnWindowDays,
      items: itemEligibility,
      message: anyEligible
        ? `Eligible items found for return within ${returnWindowDays}-day window.`
        : 'All purchased quantities have already been returned or requested.'
    };
  },

  /**
   * Create a return request for an item in a delivered order.
   */
  async createReturnRequest({ orderId, orderNumber, productId, quantity = 1, reason } = {}, context = {}) {
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Return reason is required.');
    }
    if (!productId) {
      throw new Error('productId is required.');
    }

    const reqQty = parseInt(quantity, 10);
    if (isNaN(reqQty) || reqQty <= 0) {
      throw new Error('quantity must be an integer greater than 0.');
    }

    const eligibility = await returnTools.checkReturnEligibility({ orderId, orderNumber, productId }, context);
    if (!eligibility.eligible) {
      throw new Error(`Return not eligible: ${eligibility.reason || 'Requested item cannot be returned.'}`);
    }

    const item = eligibility.items.find((i) => i.productId === productId);
    if (!item || item.availableToReturn < reqQty) {
      throw new Error(
        `Requested quantity (${reqQty}) exceeds available return quantity (${item ? item.availableToReturn : 0}).`
      );
    }

    const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const userId = context.userId;

    const returnTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO returns (
          return_number, order_id, user_id, product_id, quantity, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'requested')
      `).run(
        returnNumber,
        eligibility.orderId,
        userId,
        productId,
        reqQty,
        reason.trim()
      );

      return result.lastInsertRowid;
    });

    const returnId = returnTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'customer',
        actorId: String(userId),
        action: 'RETURN_REQUEST_CREATED',
        entityType: 'RETURN',
        entityId: returnNumber,
        agentName: context.agentName || null,
        metadata: { returnId, orderId: eligibility.orderId, productId, quantity: reqQty, reason }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      returnId,
      returnNumber,
      orderId: eligibility.orderId,
      orderNumber: eligibility.orderNumber,
      productId,
      productName: item.productName,
      quantity: reqQty,
      reason: reason.trim(),
      status: 'requested',
      message: `Return request ${returnNumber} submitted successfully. Please package the item for courier pickup.`
    };
  },

  /**
   * Retrieve return request details and current status.
   */
  async getReturnStatus({ returnNumber, returnId } = {}, context = {}) {
    if (!returnNumber && !returnId) {
      throw new Error('Either returnNumber or returnId must be provided.');
    }

    const ret = db.prepare(`
      SELECT r.*, o.order_number, p.name as product_name, p.price_paise
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN products p ON r.product_id = p.id
      WHERE r.return_number = ? OR r.id = ?
    `).get(returnNumber || null, returnId || null);

    if (!ret) {
      throw new Error('Return request not found.');
    }

    const isOwner = context.userId && ret.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view this return request.');
    }

    return {
      returnId: ret.id,
      returnNumber: ret.return_number,
      orderId: ret.order_id,
      orderNumber: ret.order_number,
      userId: ret.user_id,
      productId: ret.product_id,
      productName: ret.product_name,
      quantity: ret.quantity,
      pricePaise: ret.price_paise,
      totalRefundablePaise: ret.price_paise * ret.quantity,
      reason: ret.reason,
      status: ret.status,
      adminNotes: ret.admin_notes,
      restocked: Boolean(ret.restocked),
      createdAt: ret.created_at,
      updatedAt: ret.updated_at
    };
  },

  /**
   * Mark return as received at the warehouse and optionally restock inventory (Admin only).
   */
  async markReceived({ returnNumber, returnId, restock = true, adminNotes = '' } = {}, context = {}) {
    if (context.role !== 'admin') {
      throw new Error('Forbidden: markReceived requires administrator privileges.');
    }

    const ret = await returnTools.getReturnStatus({ returnNumber, returnId }, context);

    if (ret.status === 'received' || ret.status === 'refunded') {
      return {
        success: true,
        returnNumber: ret.returnNumber,
        status: ret.status,
        message: `Return ${ret.returnNumber} is already marked as ${ret.status}.`
      };
    }

    const markTx = db.transaction(() => {
      // 1. Update return status
      db.prepare(`
        UPDATE returns
        SET status = 'received', admin_notes = ?, restocked = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adminNotes || ret.adminNotes, restock ? 1 : 0, ret.returnId);

      // 2. Restock inventory if requested and not yet restocked
      if (restock && !ret.restocked) {
        db.prepare(`
          UPDATE products
          SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(ret.quantity, ret.productId);
      }
    });

    markTx();

    try {
      auditLogger.log({
        actorType: 'admin',
        actorId: String(context.userId || 'admin'),
        action: 'RETURN_MARKED_RECEIVED',
        entityType: 'RETURN',
        entityId: ret.returnNumber,
        agentName: context.agentName || null,
        metadata: { returnId: ret.returnId, restocked: restock, quantity: ret.quantity }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      returnId: ret.returnId,
      returnNumber: ret.returnNumber,
      status: 'received',
      restocked: restock,
      quantityRestocked: restock ? ret.quantity : 0,
      message: `Return ${ret.returnNumber} marked as received.${restock ? ' Stock returned to inventory.' : ''}`
    };
  }
};

export default returnTools;
