/**
 * paymentTools.js
 * Programmatic internal tools for simulated/mock payment verification, test failure simulation,
 * payment retries, and ledger reconciliation. Never handles real credit cards or financial data.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const paymentTools = {
  /**
   * Retrieve payment record for an order.
   */
  async getPaymentStatus({ orderId, orderNumber }, context = {}) {
    if (!orderId && !orderNumber) {
      throw new Error('Either orderId or orderNumber must be provided.');
    }

    const order = db.prepare(`
      SELECT id, order_number, user_id, total_paise, payment_method, payment_status
      FROM orders WHERE id = ? OR order_number = ?
    `).get(orderId || null, orderNumber || null);

    if (!order) {
      throw new Error('Order not found.');
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to inspect this payment.');
    }

    const payment = db.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1
    `).get(order.id);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      totalPaise: order.total_paise,
      orderPaymentStatus: order.payment_status,
      orderPaymentMethod: order.payment_method,
      paymentRecord: payment || {
        provider: 'Simulated Mock Gateway',
        status: order.payment_status.includes('Paid') ? 'successful' : 'pending',
        amountPaise: order.total_paise,
        simulated: true
      }
    };
  },

  /**
   * Test hook: simulate mock payment result (success, fail, pending).
   */
  async simulatePayment({ orderId, method = 'Demo Simulated UPI', scenario = 'success' }, context = {}) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const isOwner = context.userId && order.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to perform payment actions on this order.');
    }

    const paymentRef = `PAY-SIM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    let paymentStatus = 'successful';
    let failureReason = null;
    let orderPaymentStatus = 'Paid - Demo (Simulated)';

    if (scenario === 'fail') {
      paymentStatus = 'failed';
      failureReason = 'Simulated test failure: Demo balance insufficient or transaction declined by mock provider.';
      orderPaymentStatus = 'Payment Failed - Demo';
    } else if (scenario === 'pending') {
      paymentStatus = 'pending';
      orderPaymentStatus = 'Payment Pending - Demo';
    }

    const paymentTx = db.transaction(() => {
      // Record in payments table
      db.prepare(`
        INSERT INTO payments (
          order_id, payment_reference, provider, method, amount_paise, status, failure_reason
        ) VALUES (?, ?, 'Simulated Mock Gateway', ?, ?, ?, ?)
      `).run(order.id, paymentRef, method, order.total_paise, paymentStatus, failureReason);

      // Update order status
      db.prepare(`
        UPDATE orders SET payment_status = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orderPaymentStatus, method, order.id);
    });

    paymentTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : (context.agentName ? 'agent' : 'customer'),
        actorId: String(context.userId || 'system'),
        action: `PAYMENT_SIMULATED_${paymentStatus.toUpperCase()}`,
        entityType: 'PAYMENT',
        entityId: paymentRef,
        agentName: context.agentName || null,
        metadata: { orderId, scenario, amountPaise: order.total_paise }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: paymentStatus === 'successful',
      paymentReference: paymentRef,
      scenario,
      status: paymentStatus,
      failureReason,
      orderPaymentStatus,
      amountPaise: order.total_paise,
      simulated: true,
      message: paymentStatus === 'successful'
        ? 'Mock payment succeeded. Order is confirmed.'
        : (paymentStatus === 'failed' ? `Mock payment failed: ${failureReason}` : 'Mock payment is pending gateway response.')
    };
  },

  /**
   * Retry payment on an order whose previous payment failed or is pending.
   */
  async retryPayment({ orderId, method = 'Demo Simulated Card' }, context = {}) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    if (order.status === 'Cancelled') {
      throw new Error('Cannot retry payment for a cancelled order.');
    }

    if (order.payment_status.toLowerCase().includes('paid')) {
      return {
        success: true,
        alreadyPaid: true,
        message: `Order #${orderId} is already paid.`
      };
    }

    return paymentTools.simulatePayment({ orderId, method, scenario: 'success' }, context);
  },

  /**
   * Reconcile payment status against order totals.
   */
  async reconcile({ orderId }, context = {}) {
    const order = db.prepare('SELECT id, order_number, total_paise, payment_status FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId);
    const successfulSum = payments
      .filter((p) => p.status === 'successful')
      .reduce((acc, p) => acc + p.amount_paise, 0);

    const isMatch = successfulSum === order.total_paise || (payments.length === 0 && order.payment_status.includes('Paid'));

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderTotalPaise: order.total_paise,
      totalPaidPaise: successfulSum,
      isReconciled: isMatch,
      status: isMatch ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
      paymentsCount: payments.length
    };
  },

  /**
   * Standard AgentGuard tool: send_payment
   * Executes synthetic money disbursement / transfer to a recipient account from merchant ledger.
   */
  async send_payment({ recipientAccount, amountPaise, reference = null, description = 'Direct transfer' } = {}, context = {}) {
    if (!recipientAccount) {
      throw new Error('Recipient account is required.');
    }
    const amount = parseInt(amountPaise, 10);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Valid positive amount in integer paise is required.');
    }

    // Check merchant ledger balance
    const ledger = db.prepare('SELECT balance_paise FROM agentguard_merchant_ledger WHERE id = 1').get() || { balance_paise: 0 };
    if (ledger.balance_paise < amount) {
      throw new Error(`Insufficient merchant funds. Requested: ${amount} paise, available: ${ledger.balance_paise} paise.`);
    }

    const ref = reference || `PAY_DISBURSE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Atomic deduction and payment record insertion
    const paymentId = db.transaction(() => {
      db.prepare(`
        UPDATE agentguard_merchant_ledger
        SET balance_paise = balance_paise - ?,
            total_disbursed_paise = total_disbursed_paise + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(amount, amount);

      const info = db.prepare(`
        INSERT INTO payments (
          order_id, payment_reference, provider, method, amount_paise, status
        ) VALUES (1, ?, 'AgentGuard Disburse', 'Bank Transfer', ?, 'successful')
      `).run(ref, amount);

      return info.lastInsertRowid;
    })();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'system'),
        action: 'PAYMENT_DISBURSED',
        entityType: 'PAYMENT',
        entityId: String(paymentId),
        metadata: {
          recipientAccount,
          amountPaise: amount,
          reference: ref,
          description
        },
        agentName: context.agentName || null
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      paymentId,
      recipientAccount,
      amountPaise: amount,
      amountInr: (amount / 100).toFixed(2),
      reference: ref,
      description,
      status: 'successful'
    };
  }
};

export default paymentTools;
