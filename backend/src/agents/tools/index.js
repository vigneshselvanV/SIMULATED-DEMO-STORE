/**
 * index.js
 * Central tool registry registration module.
 * Registers all domain tools with JSON Schema parameters, permission scopes,
 * and risk classifications for OpenRouter agents.
 */

import toolRegistry from '../toolRegistry.js';
import orderTools from './orderTools.js';
import paymentTools from './paymentTools.js';
import warehouseTools from './warehouseTools.js';
import trackingTools from './trackingTools.js';
import supportTools from './supportTools.js';
import returnTools from './returnTools.js';
import refundTools from './refundTools.js';
import exportTools from './exportTools.js';
import handoffTools from './handoffTools.js';

export function registerAllTools(registry = toolRegistry) {
  // ==========================================
  // 1. ORDER TOOLS
  // ==========================================
  registry.registerTool({
    name: 'getOrder',
    description: 'Retrieve order details and line items by order ID or order number. Enforces user ownership.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'integer', description: 'Internal numeric order ID' },
        orderNumber: { type: 'string', description: 'Customer-facing order number (e.g. SPH-12345)' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => orderTools.getOrder(args, ctx)
  });

  registry.registerTool({
    name: 'listMyOrders',
    description: 'List recent orders for the currently authenticated customer session.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Maximum orders to return (1-50)', default: 10 },
        status: { type: 'string', description: 'Filter by status (e.g. Pending, Processing, Shipped, Delivered, Cancelled)' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => orderTools.listMyOrders(args, ctx)
  });

  registry.registerTool({
    name: 'cancelEligibleOrder',
    description: 'Cancel an order in Pending or Processing status and restore inventory atomically.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        orderNumber: { type: 'string', description: 'Order number' },
        reason: { type: 'string', description: 'Cancellation reason' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => orderTools.cancelEligibleOrder(args, ctx)
  });

  registry.registerTool({
    name: 'updateStatus',
    description: 'Update the processing lifecycle status of an order (Admin only).',
    parameters: {
      type: 'object',
      required: ['orderId', 'status'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        status: { type: 'string', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
        notes: { type: 'string', description: 'Optional admin notes' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'medium',
    handler: (args, ctx) => orderTools.updateStatus(args, ctx)
  });

  registry.registerTool({
    name: 'update_order',
    description: 'Update shipping address, status, or notes on an order record.',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        shippingAddress: { type: 'string', description: 'New shipping destination address' },
        status: { type: 'string', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
        notes: { type: 'string', description: 'Delivery instructions or notes' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => orderTools.update_order(args, ctx)
  });

  // ==========================================
  // 2. PAYMENT TOOLS
  // ==========================================
  registry.registerTool({
    name: 'getPaymentStatus',
    description: 'Get simulated payment status and history for an order.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        orderNumber: { type: 'string', description: 'Order number' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => paymentTools.getPaymentStatus(args, ctx)
  });

  registry.registerTool({
    name: 'simulatePayment',
    description: 'Execute a simulated mock payment for an order. Never handles real credit card numbers.',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        method: { type: 'string', description: 'Simulated payment method', default: 'Demo Simulated UPI' },
        scenario: { type: 'string', enum: ['success', 'fail', 'pending'], default: 'success' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => paymentTools.simulatePayment(args, ctx)
  });

  registry.registerTool({
    name: 'retryPayment',
    description: 'Retry a previously failed or pending simulated mock payment.',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        method: { type: 'string', description: 'Payment method name' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => paymentTools.retryPayment(args, ctx)
  });

  registry.registerTool({
    name: 'reconcile',
    description: 'Reconcile simulated payment ledger against order totals (Admin only).',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'low',
    handler: (args, ctx) => paymentTools.reconcile(args, ctx)
  });

  registry.registerTool({
    name: 'send_payment',
    description: 'Send synthetic payment disbursement or funds transfer to a recipient account.',
    parameters: {
      type: 'object',
      required: ['recipientAccount', 'amountPaise'],
      properties: {
        recipientAccount: { type: 'string', description: 'Destination bank or account identifier' },
        amountPaise: { type: 'integer', description: 'Amount to disburse in integer paise' },
        reference: { type: 'string', description: 'Transaction payment reference' },
        description: { type: 'string', description: 'Transfer purpose or description' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'high',
    handler: (args, ctx) => paymentTools.send_payment(args, ctx)
  });

  // ==========================================
  // 3. WAREHOUSE TOOLS
  // ==========================================
  registry.registerTool({
    name: 'checkStock',
    description: 'Check available inventory, physical stock, and active reservations for a product or category.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'integer', description: 'Product ID' },
        category: { type: 'string', description: 'Product category' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => warehouseTools.checkStock(args, ctx)
  });

  registry.registerTool({
    name: 'listLowStock',
    description: 'List products currently below a given stock threshold (Admin only).',
    parameters: {
      type: 'object',
      properties: {
        threshold: { type: 'integer', description: 'Stock cutoff threshold (default: 5)' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'low',
    handler: (args, ctx) => warehouseTools.listLowStock(args, ctx)
  });

  registry.registerTool({
    name: 'reserveStock',
    description: 'Temporarily hold stock reservations for an upcoming order checkout.',
    parameters: {
      type: 'object',
      required: ['productId', 'quantity'],
      properties: {
        productId: { type: 'integer', description: 'Product ID' },
        quantity: { type: 'integer', description: 'Units to reserve' },
        orderId: { type: 'integer', description: 'Associated order ID if created' },
        durationMinutes: { type: 'integer', description: 'Hold duration in minutes (default: 30)' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => warehouseTools.reserveStock(args, ctx)
  });

  registry.registerTool({
    name: 'releaseStock',
    description: 'Release a previously held inventory reservation.',
    parameters: {
      type: 'object',
      required: ['reservationId'],
      properties: {
        reservationId: { type: 'string', description: 'Unique reservation ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => warehouseTools.releaseStock(args, ctx)
  });

  registry.registerTool({
    name: 'recommendReplenishment',
    description: 'Compute replenishment reorder units and estimated restocking costs (Admin only).',
    parameters: {
      type: 'object',
      properties: {
        targetStock: { type: 'integer', description: 'Target buffer quantity per SKU (default: 50)' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'low',
    handler: (args, ctx) => warehouseTools.recommendReplenishment(args, ctx)
  });

  registry.registerTool({
    name: 'prepareDispatch',
    description: 'Verify payment, generate carrier tracking code, and create warehouse shipment for dispatch.',
    parameters: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'medium',
    handler: (args, ctx) => warehouseTools.prepareDispatch(args, ctx)
  });

  registry.registerTool({
    name: 'adjustStock',
    description: 'Manually adjust stock quantity for a product. High-risk action requiring authorization.',
    parameters: {
      type: 'object',
      required: ['productId', 'delta'],
      properties: {
        productId: { type: 'integer', description: 'Product ID' },
        delta: { type: 'integer', description: 'Adjustment amount (positive or negative non-zero integer)' },
        reason: { type: 'string', description: 'Reason for manual adjustment' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'high',
    handler: (args, ctx) => warehouseTools.adjustStock(args, ctx)
  });

  // ==========================================
  // 4. TRACKING TOOLS
  // ==========================================
  registry.registerTool({
    name: 'getTracking',
    description: 'Get current shipment status and recent milestone updates by tracking number or order ID.',
    parameters: {
      type: 'object',
      properties: {
        trackingNumber: { type: 'string', description: 'Tracking number (e.g. SPH-TRK-...)' },
        orderId: { type: 'integer', description: 'Order ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => trackingTools.getTracking(args, ctx)
  });

  registry.registerTool({
    name: 'getTimeline',
    description: 'Get complete chronological transit timeline for a tracking number.',
    parameters: {
      type: 'object',
      required: ['trackingNumber'],
      properties: {
        trackingNumber: { type: 'string', description: 'Tracking number' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => trackingTools.getTimeline(args, ctx)
  });

  registry.registerTool({
    name: 'updateShipmentStatus',
    description: 'Update shipment transit status and append carrier milestone event (Admin / Carrier).',
    parameters: {
      type: 'object',
      required: ['trackingNumber', 'status'],
      properties: {
        trackingNumber: { type: 'string', description: 'Tracking number' },
        status: {
          type: 'string',
          enum: ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned']
        },
        location: { type: 'string', description: 'Facility or city location' },
        description: { type: 'string', description: 'Event description note' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'medium',
    handler: (args, ctx) => trackingTools.updateShipmentStatus(args, ctx)
  });

  registry.registerTool({
    name: 'estimateDelivery',
    description: 'Estimate delivery ETA and remaining transit days for an active shipment.',
    parameters: {
      type: 'object',
      properties: {
        trackingNumber: { type: 'string', description: 'Tracking number' },
        orderId: { type: 'integer', description: 'Order ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => trackingTools.estimateDelivery(args, ctx)
  });

  // ==========================================
  // 5. SUPPORT TOOLS
  // ==========================================
  registry.registerTool({
    name: 'createTicket',
    description: 'Open a new customer support ticket.',
    parameters: {
      type: 'object',
      required: ['subject'],
      properties: {
        subject: { type: 'string', description: 'Short summary of the inquiry' },
        category: { type: 'string', description: 'Inquiry category (order, refund, product, technical, general)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        initialMessage: { type: 'string', description: 'Initial customer message' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => supportTools.createTicket(args, ctx)
  });

  registry.registerTool({
    name: 'getTicket',
    description: 'Retrieve support ticket details and conversation thread history.',
    parameters: {
      type: 'object',
      properties: {
        ticketNumber: { type: 'string', description: 'Ticket number' },
        conversationId: { type: 'integer', description: 'Conversation ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => supportTools.getTicket(args, ctx)
  });

  registry.registerTool({
    name: 'addMessage',
    description: 'Append a reply message to an existing support ticket thread.',
    parameters: {
      type: 'object',
      required: ['message'],
      properties: {
        ticketNumber: { type: 'string', description: 'Ticket number' },
        conversationId: { type: 'integer', description: 'Conversation ID' },
        message: { type: 'string', description: 'Message body' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => supportTools.addMessage(args, ctx)
  });

  registry.registerTool({
    name: 'escalateToHuman',
    description: 'Escalate an active support ticket to a human support agent.',
    parameters: {
      type: 'object',
      properties: {
        ticketNumber: { type: 'string', description: 'Ticket number' },
        conversationId: { type: 'integer', description: 'Conversation ID' },
        reason: { type: 'string', description: 'Reason for escalation' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => supportTools.escalateToHuman(args, ctx)
  });

  // ==========================================
  // 6. RETURN TOOLS
  // ==========================================
  registry.registerTool({
    name: 'checkReturnEligibility',
    description: 'Check whether an order or specific item is within the return policy window and eligible for return.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        orderNumber: { type: 'string', description: 'Order number' },
        productId: { type: 'integer', description: 'Optional specific product ID' },
        returnWindowDays: { type: 'integer', description: 'Return window in days (default: 30)' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => returnTools.checkReturnEligibility(args, ctx)
  });

  registry.registerTool({
    name: 'createReturnRequest',
    description: 'Initiate a formal return request for an eligible item in a delivered order.',
    parameters: {
      type: 'object',
      required: ['productId', 'reason'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        orderNumber: { type: 'string', description: 'Order number' },
        productId: { type: 'integer', description: 'Product ID' },
        quantity: { type: 'integer', description: 'Units to return', default: 1 },
        reason: { type: 'string', description: 'Reason for return' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'medium',
    handler: (args, ctx) => returnTools.createReturnRequest(args, ctx)
  });

  registry.registerTool({
    name: 'getReturnStatus',
    description: 'Check return request status, inspection notes, and restocking state.',
    parameters: {
      type: 'object',
      properties: {
        returnNumber: { type: 'string', description: 'Return number (e.g. RET-...)' },
        returnId: { type: 'integer', description: 'Return ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => returnTools.getReturnStatus(args, ctx)
  });

  registry.registerTool({
    name: 'markReceived',
    description: 'Mark returned item as physically received at warehouse and restock inventory (Admin only).',
    parameters: {
      type: 'object',
      properties: {
        returnNumber: { type: 'string', description: 'Return number' },
        returnId: { type: 'integer', description: 'Return ID' },
        restock: { type: 'boolean', description: 'Whether to restock item quantity', default: true },
        adminNotes: { type: 'string', description: 'Inspection notes' }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'medium',
    handler: (args, ctx) => returnTools.markReceived(args, ctx)
  });

  // ==========================================
  // 7. REFUND TOOLS
  // ==========================================
  registry.registerTool({
    name: 'calculateRefund',
    description: 'Calculate item and shipping refund amounts in integer paise according to refund policies.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        returnId: { type: 'integer', description: 'Return ID' },
        itemsToRefund: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'integer' },
              quantity: { type: 'integer' }
            }
          }
        },
        includeShipping: { type: 'boolean', default: false }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => refundTools.calculateRefund(args, ctx)
  });

  registry.registerTool({
    name: 'createMockRefund',
    description: 'Execute simulated mock refund in integer paise. High amounts require human approval.',
    parameters: {
      type: 'object',
      required: ['amountPaise'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        returnId: { type: 'integer', description: 'Associated return ID' },
        amountPaise: { type: 'integer', description: 'Refund amount in integer paise' },
        reason: { type: 'string', description: 'Reason for refund' },
        idempotencyKey: { type: 'string', description: 'Unique idempotency key' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'high',
    handler: (args, ctx) => refundTools.createMockRefund(args, ctx)
  });

  registry.registerTool({
    name: 'getRefundStatus',
    description: 'Check status of simulated refund transaction.',
    parameters: {
      type: 'object',
      properties: {
        refundNumber: { type: 'string', description: 'Refund reference number' },
        orderId: { type: 'integer', description: 'Order ID' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => refundTools.getRefundStatus(args, ctx)
  });

  registry.registerTool({
    name: 'issue_refund',
    description: 'Issue refund for an order in integer paise.',
    parameters: {
      type: 'object',
      required: ['orderId', 'amountPaise'],
      properties: {
        orderId: { type: 'integer', description: 'Order ID' },
        amountPaise: { type: 'integer', description: 'Refund amount in integer paise' },
        reason: { type: 'string', description: 'Justification for refund' },
        idempotencyKey: { type: 'string', description: 'Optional unique idempotency key' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'high',
    handler: (args, ctx) => refundTools.issue_refund(args, ctx)
  });

  // ==========================================
  // 8. EXPORT TOOLS
  // ==========================================
  registry.registerTool({
    name: 'exportOrdersCsv',
    description: 'Export orders into CSV report with formula injection sanitization.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status filter' },
        limit: { type: 'integer', description: 'Max rows (up to 1000)', default: 100 }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => exportTools.exportOrdersCsv(args, ctx)
  });

  registry.registerTool({
    name: 'exportInventoryCsv',
    description: 'Export warehouse inventory catalog into CSV report with formula injection sanitization (Admin only).',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter category' },
        lowStockOnly: { type: 'boolean', description: 'Only export low-stock items', default: false }
      }
    },
    permissionScope: 'admin',
    riskLevel: 'low',
    handler: (args, ctx) => exportTools.exportInventoryCsv(args, ctx)
  });

  registry.registerTool({
    name: 'export_customers',
    description: 'Export customer accounts and contact information to CSV format.',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', default: 'csv' },
        limit: { type: 'integer', description: 'Maximum customer records to dump (default: 100)' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'high',
    handler: (args, ctx) => exportTools.export_customers(args, ctx)
  });

  // ==========================================
  // 9. HANDOFF & ROUTING TOOLS
  // ==========================================
  registry.registerTool({
    name: 'routeToAgent',
    description: 'Route or delegate a customer inquiry to a specialized domain agent.',
    parameters: {
      type: 'object',
      required: ['targetAgent', 'query'],
      properties: {
        targetAgent: {
          type: 'string',
          enum: ['OrderAgent', 'PaymentAgent', 'WarehouseAgent', 'TrackingAgent', 'ReturnAgent', 'RefundAgent'],
          description: 'The specialized agent to hand off to'
        },
        query: { type: 'string', description: 'The question or inquiry for the target agent' },
        reason: { type: 'string', description: 'Reason for handoff' }
      }
    },
    permissionScope: 'customer',
    riskLevel: 'low',
    handler: (args, ctx) => handoffTools.routeToAgent(args, ctx)
  });

  return registry;
}

// Automatically register all tools into the default singleton toolRegistry
registerAllTools(toolRegistry);

export {
  orderTools,
  paymentTools,
  warehouseTools,
  trackingTools,
  supportTools,
  returnTools,
  refundTools,
  exportTools,
  handoffTools
};

export default toolRegistry;
