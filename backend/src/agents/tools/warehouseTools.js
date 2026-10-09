/**
 * warehouseTools.js
 * Programmatic internal tools for inventory inspection, stock reservation,
 * replenishment recommendation, dispatch preparation, and manual stock adjustments.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const warehouseTools = {
  /**
   * Check stock levels for a specific product or category.
   */
  async checkStock({ productId, category } = {}) {
    if (productId) {
      const product = db.prepare(`
        SELECT id, name, category, price_paise, stock_quantity, image_url
        FROM products WHERE id = ?
      `).get(productId);

      if (!product) {
        throw new Error(`Product with ID ${productId} not found.`);
      }

      // Calculate active reservations
      const reservationRow = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as reserved_quantity
        FROM inventory_reservations
        WHERE product_id = ? AND status = 'reserved' AND expires_at > CURRENT_TIMESTAMP
      `).get(productId);

      const reservedQuantity = reservationRow.reserved_quantity || 0;
      const availableQuantity = Math.max(0, product.stock_quantity - reservedQuantity);

      return {
        productId: product.id,
        name: product.name,
        category: product.category,
        pricePaise: product.price_paise,
        stockQuantity: product.stock_quantity,
        reservedQuantity,
        availableQuantity,
        isLowStock: availableQuantity <= 5
      };
    }

    if (category) {
      const products = db.prepare(`
        SELECT id, name, category, price_paise, stock_quantity
        FROM products
        WHERE category = ?
        ORDER BY stock_quantity ASC
      `).all(category);

      return {
        category,
        count: products.length,
        products
      };
    }

    // Default overview
    const totalInventory = db.prepare(`
      SELECT COUNT(*) as totalProducts, SUM(stock_quantity) as totalUnits
      FROM products
    `).get();

    return {
      totalProducts: totalInventory.totalProducts,
      totalUnits: totalInventory.totalUnits
    };
  },

  /**
   * List products running low on stock.
   */
  async listLowStock({ threshold = 5 } = {}) {
    const safeThreshold = Math.max(0, parseInt(threshold, 10) || 5);
    const lowStockItems = db.prepare(`
      SELECT p.id, p.name, p.category, p.stock_quantity, p.price_paise,
        COALESCE((
          SELECT SUM(r.quantity)
          FROM inventory_reservations r
          WHERE r.product_id = p.id AND r.status = 'reserved' AND r.expires_at > CURRENT_TIMESTAMP
        ), 0) as reserved_quantity
      FROM products p
      WHERE p.stock_quantity <= ?
      ORDER BY p.stock_quantity ASC
    `).all(safeThreshold);

    const items = lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      pricePaise: item.price_paise,
      stockQuantity: item.stock_quantity,
      reservedQuantity: item.reserved_quantity,
      availableQuantity: Math.max(0, item.stock_quantity - item.reserved_quantity)
    }));

    return {
      threshold: safeThreshold,
      count: items.length,
      items
    };
  },

  /**
   * Temporarily reserve stock for an impending order (default: 30 minutes).
   */
  async reserveStock({ productId, quantity, orderId = null, durationMinutes = 30 } = {}) {
    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Valid productId and quantity greater than 0 are required.');
    }

    const safeDuration = Math.max(1, Math.min(1440, parseInt(durationMinutes, 10) || 30));
    const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const reservationTx = db.transaction(() => {
      const product = db.prepare('SELECT id, name, stock_quantity FROM products WHERE id = ?').get(productId);
      if (!product) {
        throw new Error(`Product #${productId} not found.`);
      }

      const reservedRow = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as reserved_quantity
        FROM inventory_reservations
        WHERE product_id = ? AND status = 'reserved' AND expires_at > CURRENT_TIMESTAMP
      `).get(productId);

      const available = product.stock_quantity - (reservedRow.reserved_quantity || 0);
      if (available < quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${available}, requested: ${quantity}.`);
      }

      db.prepare(`
        INSERT INTO inventory_reservations (
          reservation_id, product_id, quantity, order_id, status, expires_at
        ) VALUES (?, ?, ?, ?, 'reserved', datetime(CURRENT_TIMESTAMP, '+' || ? || ' minutes'))
      `).run(reservationId, productId, quantity, orderId || null, safeDuration);

      return {
        reservationId,
        productId,
        productName: product.name,
        quantity,
        orderId,
        expiresInMinutes: safeDuration
      };
    });

    const result = reservationTx();
    return {
      success: true,
      ...result
    };
  },

  /**
   * Release a previously held stock reservation.
   */
  async releaseStock({ reservationId }, context = {}) {
    if (!reservationId) {
      throw new Error('reservationId is required to release stock.');
    }

    const reservation = db.prepare(`
      SELECT * FROM inventory_reservations WHERE reservation_id = ?
    `).get(reservationId);

    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found.`);
    }

    if (reservation.status !== 'reserved') {
      return {
        success: true,
        message: `Reservation ${reservationId} is already ${reservation.status}.`
      };
    }

    db.prepare(`
      UPDATE inventory_reservations SET status = 'released' WHERE reservation_id = ?
    `).run(reservationId);

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'warehouse-agent'),
        action: 'INVENTORY_RESERVATION_RELEASED',
        entityType: 'INVENTORY',
        entityId: reservationId,
        agentName: context.agentName || null,
        metadata: { productId: reservation.product_id, quantity: reservation.quantity }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      reservationId,
      status: 'released',
      message: `Reservation ${reservationId} has been released.`
    };
  },

  /**
   * Recommend replenishment quantities based on current stock levels and target buffer.
   */
  async recommendReplenishment({ targetStock = 50 } = {}) {
    const safeTarget = Math.max(1, parseInt(targetStock, 10) || 50);

    const products = db.prepare(`
      SELECT id, name, category, stock_quantity, price_paise
      FROM products
      WHERE stock_quantity < ?
      ORDER BY stock_quantity ASC
    `).all(safeTarget);

    const recommendations = products.map((p) => {
      const unitsNeeded = Math.max(0, safeTarget - p.stock_quantity);
      // Assume estimated replenishment cost is ~60% of retail price
      const estimatedCostPaise = Math.round(unitsNeeded * (p.price_paise * 0.6));
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock_quantity,
        targetStock: safeTarget,
        recommendedReorderUnits: unitsNeeded,
        estimatedCostPaise
      };
    });

    const totalUnitsToOrder = recommendations.reduce((acc, r) => acc + r.recommendedReorderUnits, 0);
    const totalEstimatedCostPaise = recommendations.reduce((acc, r) => acc + r.estimatedCostPaise, 0);

    return {
      targetStock: safeTarget,
      itemsToReplenishCount: recommendations.length,
      totalUnitsToOrder,
      totalEstimatedCostPaise,
      recommendations
    };
  },

  /**
   * Prepare an order for dispatch: verify payment, assign carrier tracking, create shipment.
   */
  async prepareDispatch({ orderId }, context = {}) {
    if (!orderId) {
      throw new Error('orderId is required to prepare dispatch.');
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    if (order.status === 'Cancelled') {
      throw new Error(`Cannot prepare dispatch for cancelled order #${orderId}.`);
    }

    if (!order.payment_status.toLowerCase().includes('paid')) {
      throw new Error(`Cannot dispatch unpaid order #${orderId} (Status: ${order.payment_status}).`);
    }

    // Check if shipment already exists
    let existingShipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
    if (existingShipment) {
      return {
        success: true,
        alreadyDispatched: true,
        shipmentId: existingShipment.id,
        trackingNumber: existingShipment.tracking_number,
        status: existingShipment.status,
        message: `Order #${orderId} has already been prepared for dispatch with tracking #${existingShipment.tracking_number}.`
      };
    }

    const trackingNumber = `SPH-TRK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const dispatchTx = db.transaction(() => {
      // 1. Create shipment record
      const shipmentResult = db.prepare(`
        INSERT INTO shipments (
          order_id, tracking_number, carrier, status, estimated_delivery_date, shipped_at
        ) VALUES (?, ?, 'SphereExpress', 'label_created', datetime(CURRENT_TIMESTAMP, '+3 days'), CURRENT_TIMESTAMP)
      `).run(order.id, trackingNumber);

      const shipmentId = shipmentResult.lastInsertRowid;

      // 2. Record initial timeline event
      db.prepare(`
        INSERT INTO shipment_events (
          shipment_id, status, location, description
        ) VALUES (?, 'label_created', 'Warehouse Fulfillment Center, Bengaluru', 'Shipping label created. Package boxed and ready for carrier handover.')
      `).run(shipmentId);

      // 3. Update order tracking number and status
      db.prepare(`
        UPDATE orders
        SET tracking_number = ?, status = 'Processing', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(trackingNumber, order.id);

      return { shipmentId, trackingNumber };
    });

    const { shipmentId, trackingNumber: generatedTracking } = dispatchTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'warehouse-agent'),
        action: 'ORDER_DISPATCH_PREPARED',
        entityType: 'ORDER',
        entityId: String(orderId),
        agentName: context.agentName || null,
        metadata: { shipmentId, trackingNumber: generatedTracking }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      orderId,
      orderNumber: order.order_number,
      shipmentId,
      trackingNumber: generatedTracking,
      carrier: 'SphereExpress',
      status: 'label_created',
      message: `Dispatch prepared for order #${order.order_number}. Tracking number: ${generatedTracking}.`
    };
  },

  /**
   * Adjust stock manually (Admin / Warehouse authorized).
   * High-risk action: gated by approval or admin privileges.
   */
  async adjustStock({ productId, delta, reason = 'Manual inventory adjustment' }, context = {}) {
    if (!productId || delta === undefined || delta === null) {
      throw new Error('productId and delta are required.');
    }

    const deltaInt = parseInt(delta, 10);
    if (isNaN(deltaInt) || deltaInt === 0) {
      throw new Error('delta must be a non-zero integer.');
    }

    const product = db.prepare('SELECT id, name, stock_quantity FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw new Error(`Product #${productId} not found.`);
    }

    const newStock = product.stock_quantity + deltaInt;
    if (newStock < 0) {
      throw new Error(`Adjustment would result in negative stock (${newStock}) for product "${product.name}".`);
    }

    db.prepare(`
      UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newStock, productId);

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'system'),
        action: 'INVENTORY_STOCK_ADJUSTED',
        entityType: 'PRODUCT',
        entityId: String(productId),
        beforeState: { stockQuantity: product.stock_quantity },
        afterState: { stockQuantity: newStock, delta: deltaInt, reason },
        agentName: context.agentName || null,
        metadata: { reason }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      productId,
      productName: product.name,
      previousStock: product.stock_quantity,
      newStock,
      delta: deltaInt,
      reason
    };
  }
};

export default warehouseTools;
