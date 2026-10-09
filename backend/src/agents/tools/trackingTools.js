/**
 * trackingTools.js
 * Programmatic internal tools for tracking shipments, timeline events,
 * carrier milestone updates, and delivery date estimation.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const trackingTools = {
  /**
   * Get tracking information by tracking number or order ID.
   */
  async getTracking({ trackingNumber, orderId }, context = {}) {
    if (!trackingNumber && !orderId) {
      throw new Error('Either trackingNumber or orderId must be provided.');
    }

    let shipment = null;
    if (trackingNumber) {
      shipment = db.prepare(`
        SELECT s.*, o.order_number, o.user_id, o.customer_name, o.city, o.state, o.postal_code, o.status as order_status
        FROM shipments s
        JOIN orders o ON s.order_id = o.id
        WHERE s.tracking_number = ?
      `).get(trackingNumber);
    } else {
      shipment = db.prepare(`
        SELECT s.*, o.order_number, o.user_id, o.customer_name, o.city, o.state, o.postal_code, o.status as order_status
        FROM shipments s
        JOIN orders o ON s.order_id = o.id
        WHERE s.order_id = ?
      `).get(orderId);
    }

    if (!shipment) {
      // Check if order exists but hasn't shipped yet
      if (orderId) {
        const order = db.prepare('SELECT id, order_number, user_id, status FROM orders WHERE id = ?').get(orderId);
        if (order) {
          const isOwner = context.userId && order.user_id === context.userId;
          const isAdmin = context.role === 'admin';
          if (!isOwner && !isAdmin) {
            throw new Error('Forbidden: You do not have permission to view tracking for this order.');
          }
          return {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'unshipped',
            carrier: 'Pending assignment',
            message: `Order #${order.order_number} is currently ${order.status}. A tracking number will be assigned upon dispatch.`
          };
        }
      }
      throw new Error('Shipment tracking record not found.');
    }

    // Ownership check
    const isOwner = context.userId && shipment.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view tracking for this shipment.');
    }

    // Fetch timeline events
    const events = db.prepare(`
      SELECT id, status, location, description, event_time
      FROM shipment_events
      WHERE shipment_id = ?
      ORDER BY id ASC
    `).all(shipment.id);

    return {
      trackingNumber: shipment.tracking_number,
      orderId: shipment.order_id,
      orderNumber: shipment.order_number,
      carrier: shipment.carrier,
      status: shipment.status,
      estimatedDeliveryDate: shipment.estimated_delivery_date,
      shippedAt: shipment.shipped_at,
      deliveredAt: shipment.delivered_at,
      destination: `${shipment.city}, ${shipment.state} - ${shipment.postal_code}`,
      events
    };
  },

  /**
   * Retrieve chronological event timeline for a tracking number.
   */
  async getTimeline({ trackingNumber }, context = {}) {
    if (!trackingNumber) {
      throw new Error('trackingNumber is required to retrieve timeline.');
    }

    const trackingData = await trackingTools.getTracking({ trackingNumber }, context);
    return {
      trackingNumber,
      carrier: trackingData.carrier,
      currentStatus: trackingData.status,
      estimatedDeliveryDate: trackingData.estimatedDeliveryDate,
      timeline: trackingData.events
    };
  },

  /**
   * Update shipment status and record milestone event (Admin / Carrier authorized).
   */
  async updateShipmentStatus({ trackingNumber, status, location = 'Transit Facility', description }, context = {}) {
    if (!trackingNumber || !status) {
      throw new Error('trackingNumber and status are required.');
    }

    const validStatuses = ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid shipment status "${status}". Valid options: ${validStatuses.join(', ')}`);
    }

    const shipment = db.prepare(`
      SELECT s.*, o.id as order_id, o.status as order_status
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      WHERE s.tracking_number = ?
    `).get(trackingNumber);

    if (!shipment) {
      throw new Error(`Shipment with tracking number "${trackingNumber}" not found.`);
    }

    const defaultDescriptions = {
      label_created: 'Shipping label created. Package awaiting carrier pickup.',
      picked_up: 'Package picked up by carrier from fulfillment center.',
      in_transit: 'Package in transit towards the destination hub.',
      out_for_delivery: 'Package is out for delivery with local courier.',
      delivered: 'Package delivered successfully to customer address.',
      failed_delivery: 'Delivery attempt failed. Courier will retry next business day.',
      returned: 'Package returned to sender.'
    };

    const finalDescription = description || defaultDescriptions[status] || `Shipment status updated to ${status}.`;

    const updateTx = db.transaction(() => {
      // 1. Insert shipment event
      db.prepare(`
        INSERT INTO shipment_events (shipment_id, status, location, description)
        VALUES (?, ?, ?, ?)
      `).run(shipment.id, status, location, finalDescription);

      // 2. Update shipment record
      if (status === 'delivered') {
        db.prepare(`
          UPDATE shipments
          SET status = ?, delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(status, shipment.id);

        db.prepare(`
          UPDATE orders
          SET status = 'Delivered', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(shipment.order_id);
      } else if (status === 'in_transit' || status === 'out_for_delivery' || status === 'picked_up') {
        db.prepare(`
          UPDATE shipments
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(status, shipment.id);

        db.prepare(`
          UPDATE orders
          SET status = 'Shipped', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(shipment.order_id);
      } else {
        db.prepare(`
          UPDATE shipments
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(status, shipment.id);
      }
    });

    updateTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'tracking-agent'),
        action: 'SHIPMENT_STATUS_UPDATED',
        entityType: 'SHIPMENT',
        entityId: trackingNumber,
        beforeState: { status: shipment.status },
        afterState: { status, location, description: finalDescription },
        agentName: context.agentName || null
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      trackingNumber,
      previousStatus: shipment.status,
      newStatus: status,
      location,
      description: finalDescription,
      message: `Shipment #${trackingNumber} updated to "${status}".`
    };
  },

  /**
   * Estimate delivery date and remaining days based on order and carrier progress.
   */
  async estimateDelivery({ orderId, trackingNumber }, context = {}) {
    const trackingData = await trackingTools.getTracking({ trackingNumber, orderId }, context);

    if (trackingData.status === 'delivered') {
      return {
        trackingNumber: trackingData.trackingNumber,
        status: 'delivered',
        deliveredAt: trackingData.deliveredAt,
        message: 'This package has already been delivered.'
      };
    }

    if (trackingData.status === 'unshipped') {
      return {
        orderId: trackingData.orderId,
        status: 'unshipped',
        estimatedDeliveryDate: 'Within 3-5 business days upon dispatch',
        message: 'Order is being processed in our warehouse. Estimated delivery is 3-5 business days after carrier handover.'
      };
    }

    const eta = trackingData.estimatedDeliveryDate;
    let daysRemaining = null;
    if (eta) {
      const diffMs = new Date(eta).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      trackingNumber: trackingData.trackingNumber,
      carrier: trackingData.carrier,
      status: trackingData.status,
      destination: trackingData.destination,
      estimatedDeliveryDate: eta,
      daysRemaining,
      summary: daysRemaining === 0
        ? 'Expected to arrive today!'
        : `Expected delivery in approximately ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
    };
  }
};

export default trackingTools;
