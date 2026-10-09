/**
 * refundTools.js
 * Programmatic internal tools for refund calculation in integer paise,
 * simulated mock refund execution with idempotency, and refund tracking.
 * Never handles real payment credentials.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const refundTools = {
  /**
   * Calculate precise refund amount in integer paise with proportional and item-level breakdown.
   */
  async calculateRefund({ orderId, returnId, itemsToRefund, includeShipping = false } = {}, context = {}) {
    let resolvedOrderId = orderId;

    if (!resolvedOrderId && returnId) {
      const ret = db.prepare('SELECT order_id FROM returns WHERE id = ? OR return_number = ?').get(returnId, returnId);
      if (ret) resolvedOrderId = ret.order_id;
    }

    if (!resolvedOrderId) {
      throw new Error('Either orderId or returnId must be provided to calculate refund.');
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(resolvedOrderId);
    if (!order) {
      throw new Error(`Order #${resolvedOrderId} not found.`);
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view refund calculations for this order.');
    }

    // Check existing refunds
    const existingRefunds = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_refunded
      FROM refunds
      WHERE order_id = ? AND status = 'completed'
    `).get(order.id);

    const alreadyRefundedPaise = existingRefunds.total_refunded || 0;
    const maxRemainingPaise = Math.max(0, order.total_paise - alreadyRefundedPaise);

    let calculatedItemPaise = 0;
    let itemsBreakdown = [];

    if (returnId) {
      const ret = db.prepare(`
        SELECT r.*, p.name as product_name, p.price_paise
        FROM returns r
        JOIN products p ON r.product_id = p.id
        WHERE r.id = ? OR r.return_number = ?
      `).get(returnId, returnId);

      if (ret) {
        const itemAmount = ret.price_paise * ret.quantity;
        calculatedItemPaise += itemAmount;
        itemsBreakdown.push({
          returnId: ret.id,
          returnNumber: ret.return_number,
          productId: ret.product_id,
          productName: ret.product_name,
          quantity: ret.quantity,
          unitPricePaise: ret.price_paise,
          subtotalPaise: itemAmount
        });
      }
    } else if (Array.isArray(itemsToRefund) && itemsToRefund.length > 0) {
      for (const item of itemsToRefund) {
        const orderItem = db.prepare(`
          SELECT * FROM order_items WHERE order_id = ? AND product_id = ?
        `).get(order.id, item.productId);

        if (orderItem) {
          const qty = Math.min(item.quantity || 1, orderItem.quantity);
          const subtotal = orderItem.price_paise * qty;
          calculatedItemPaise += subtotal;
          itemsBreakdown.push({
            productId: orderItem.product_id,
            productName: orderItem.product_name,
            quantity: qty,
            unitPricePaise: orderItem.price_paise,
            subtotalPaise: subtotal
          });
        }
      }
    } else {
      // Full order calculation
      calculatedItemPaise = order.subtotal_paise;
    }

    let shippingPaise = 0;
    if (includeShipping) {
      shippingPaise = order.shipping_paise;
    }

    const proposedTotalPaise = calculatedItemPaise + shippingPaise;
    const finalRefundPaise = Math.min(proposedTotalPaise, maxRemainingPaise);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderTotalPaise: order.total_paise,
      alreadyRefundedPaise,
      maxRemainingRefundablePaise: maxRemainingPaise,
      itemsSubtotalPaise: calculatedItemPaise,
      shippingIncludedPaise: shippingPaise,
      proposedRefundPaise: finalRefundPaise,
      currency: 'INR',
      items: itemsBreakdown
    };
  },

  /**
   * Execute simulated mock refund with idempotency protection and balance constraints.
   */
  async createMockRefund({ orderId, returnId = null, amountPaise, reason = 'Customer refund request', idempotencyKey = null } = {}, context = {}) {
    if (!orderId && !returnId) {
      throw new Error('orderId or returnId is required to process refund.');
    }

    let resolvedOrderId = orderId;
    let resolvedReturnId = null;

    if (returnId) {
      const ret = db.prepare('SELECT id, order_id, user_id FROM returns WHERE id = ? OR return_number = ?').get(returnId, returnId);
      if (!ret) {
        throw new Error(`Return record #${returnId} not found.`);
      }
      resolvedReturnId = ret.id;
      if (!resolvedOrderId) {
        resolvedOrderId = ret.order_id;
      }
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(resolvedOrderId);
    if (!order) {
      throw new Error(`Order #${resolvedOrderId} not found.`);
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to issue refunds on this order.');
    }

    // 1. Idempotency check: Return existing refund if key repeats
    if (idempotencyKey) {
      const existingRefund = db.prepare('SELECT * FROM refunds WHERE idempotency_key = ?').get(idempotencyKey);
      if (existingRefund) {
        return {
          success: true,
          idempotent: true,
          refundId: existingRefund.id,
          refundNumber: existingRefund.refund_number,
          orderId: existingRefund.order_id,
          amountPaise: existingRefund.amount_paise,
          status: existingRefund.status,
          simulatedReference: existingRefund.simulated_provider_reference,
          message: `Idempotent replay: Refund ${existingRefund.refund_number} was previously executed.`
        };
      }
    }

    const finalAmount = parseInt(amountPaise, 10);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      throw new Error('amountPaise must be a positive integer in paise.');
    }

    // 2. Validate remaining balance
    const existingRefunds = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_refunded
      FROM refunds
      WHERE order_id = ? AND status = 'completed'
    `).get(order.id);

    const alreadyRefunded = existingRefunds.total_refunded || 0;
    const remainingBalance = order.total_paise - alreadyRefunded;

    if (finalAmount > remainingBalance) {
      throw new Error(
        `Requested refund (${finalAmount} paise) exceeds order refundable balance (${remainingBalance} paise).`
      );
    }

    const refundNumber = `RFD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const simProviderRef = `SIM-RFD-TXN-${Date.now()}`;
    const autoIdempotencyKey = idempotencyKey || `idem-${refundNumber}`;

    const refundTx = db.transaction(() => {
      // Insert refund record
      const insertResult = db.prepare(`
        INSERT INTO refunds (
          refund_number, order_id, return_id, amount_paise, reason, status, idempotency_key, simulated_provider_reference
        ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
      `).run(
        refundNumber,
        order.id,
        resolvedReturnId,
        finalAmount,
        reason,
        autoIdempotencyKey,
        simProviderRef
      );

      const refundId = insertResult.lastInsertRowid;

      // Update order payment status
      const newTotalRefunded = alreadyRefunded + finalAmount;
      const orderPaymentStatus = newTotalRefunded >= order.total_paise
        ? 'Refunded - Demo (Simulated)'
        : 'Partially Refunded - Demo (Simulated)';

      db.prepare(`
        UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(orderPaymentStatus, order.id);

      // If associated with a return, update return status
      if (resolvedReturnId) {
        db.prepare(`
          UPDATE returns SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(resolvedReturnId);
      }

      // Update payments table status
      db.prepare(`
        UPDATE payments
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(newTotalRefunded >= order.total_paise ? 'refunded' : 'partially_refunded', order.id);

      return { refundId, orderPaymentStatus, newTotalRefunded };
    });

    const { refundId, orderPaymentStatus, newTotalRefunded } = refundTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : (context.agentName ? 'agent' : 'customer'),
        actorId: String(context.userId || 'refund-agent'),
        action: 'MOCK_REFUND_EXECUTED',
        entityType: 'REFUND',
        entityId: refundNumber,
        agentName: context.agentName || null,
        metadata: {
          refundId,
          orderId: order.id,
          amountPaise: finalAmount,
          idempotencyKey: autoIdempotencyKey,
          newTotalRefunded
        }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      refundId,
      refundNumber,
      orderId: order.id,
      orderNumber: order.order_number,
      amountPaise: finalAmount,
      reason,
      status: 'completed',
      orderPaymentStatus,
      totalRefundedToDatePaise: newTotalRefunded,
      simulatedProviderReference: simProviderRef,
      message: `Simulated refund ${refundNumber} for ₹${(finalAmount / 100).toFixed(2)} processed successfully.`
    };
  },

  /**
   * Retrieve refund status by refund number or order ID.
   */
  async getRefundStatus({ refundNumber, orderId } = {}, context = {}) {
    if (!refundNumber && !orderId) {
      throw new Error('Either refundNumber or orderId must be provided.');
    }

    if (refundNumber) {
      const refund = db.prepare(`
        SELECT r.*, o.order_number, o.user_id, o.total_paise as order_total_paise
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        WHERE r.refund_number = ?
      `).get(refundNumber);

      if (!refund) {
        throw new Error(`Refund #${refundNumber} not found.`);
      }

      const isOwner = context.userId && refund.user_id === context.userId;
      const isAdmin = context.role === 'admin';
      if (!isOwner && !isAdmin) {
        throw new Error('Forbidden: You do not have permission to view this refund.');
      }

      return {
        refundId: refund.id,
        refundNumber: refund.refund_number,
        orderId: refund.order_id,
        orderNumber: refund.order_number,
        amountPaise: refund.amount_paise,
        reason: refund.reason,
        status: refund.status,
        simulatedProviderReference: refund.simulated_provider_reference,
        createdAt: refund.created_at
      };
    }

    const order = db.prepare('SELECT id, order_number, user_id, total_paise, payment_status FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view refunds for this order.');
    }

    const refunds = db.prepare(`
      SELECT id, refund_number, amount_paise, reason, status, simulated_provider_reference, created_at
      FROM refunds
      WHERE order_id = ?
      ORDER BY id DESC
    `).all(order.id);

    const totalRefundedPaise = refunds.reduce((acc, r) => acc + (r.status === 'completed' ? r.amount_paise : 0), 0);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderTotalPaise: order.total_paise,
      totalRefundedPaise,
      orderPaymentStatus: order.payment_status,
      refundsCount: refunds.length,
      refunds
    };
  },

  /**
   * Standard AgentGuard tool: issue_refund
   * Issues refund to order in integer paise, records refund ledger transaction, and updates order status.
   */
  async issue_refund({ orderId, amountPaise, reason = 'Agent requested refund', idempotencyKey = null } = {}, context = {}) {
    const finalAmount = parseInt(amountPaise, 10);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      throw new Error('amountPaise must be a positive integer in paise.');
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    // Validate remaining balance
    const existingRefunds = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_refunded
      FROM refunds
      WHERE order_id = ? AND status = 'completed'
    `).get(order.id);

    const alreadyRefunded = existingRefunds.total_refunded || 0;
    const remainingBalance = Math.max(0, order.total_paise - alreadyRefunded);

    if (finalAmount > remainingBalance) {
      throw new Error(
        `Requested refund (${finalAmount} paise) exceeds order refundable balance (${remainingBalance} paise).`
      );
    }

    const refundNumber = `RFD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const autoIdempotencyKey = idempotencyKey || `idemp_rfd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const simProviderRef = `SIM_REF_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const refundTx = db.transaction(() => {
      const insertResult = db.prepare(`
        INSERT INTO refunds (
          refund_number, order_id, return_id, amount_paise, reason, status, idempotency_key, simulated_provider_reference
        ) VALUES (?, ?, NULL, ?, ?, 'completed', ?, ?)
      `).run(
        refundNumber,
        order.id,
        finalAmount,
        reason,
        autoIdempotencyKey,
        simProviderRef
      );

      const refundId = insertResult.lastInsertRowid;
      const newTotalRefunded = alreadyRefunded + finalAmount;
      const orderPaymentStatus = newTotalRefunded >= order.total_paise
        ? 'Refunded - Demo (Simulated)'
        : 'Partially Refunded - Demo (Simulated)';

      db.prepare(`
        UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(orderPaymentStatus, order.id);

      return { refundId, orderPaymentStatus, newTotalRefunded };
    });

    const { refundId, orderPaymentStatus, newTotalRefunded } = refundTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : (context.agentName ? 'agent' : 'customer'),
        actorId: String(context.userId || 'refund-agent'),
        action: 'MOCK_REFUND_EXECUTED',
        entityType: 'REFUND',
        entityId: refundNumber,
        agentName: context.agentName || null,
        metadata: {
          refundId,
          orderId: order.id,
          amountPaise: finalAmount,
          reason
        }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      refundId,
      refundNumber,
      orderId: order.id,
      orderNumber: order.order_number,
      amountPaise: finalAmount,
      reason,
      status: 'completed',
      orderPaymentStatus,
      totalRefundedToDatePaise: newTotalRefunded,
      simulatedProviderReference: simProviderRef,
      message: `Refund ${refundNumber} for ₹${(finalAmount / 100).toFixed(2)} processed successfully.`
    };
  }
};

export default refundTools;
