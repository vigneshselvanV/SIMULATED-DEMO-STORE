import db from '../config/db.js';
import auditLogger from '../services/auditLogger.js';

const FREE_SHIPPING_THRESHOLD_PAISE = 50000; // ₹500
const STANDARD_SHIPPING_PAISE = 4900;        // ₹49

function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SPH-${dateStr}-${randomPart}`;
}

export function createOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const idempotencyKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim();

    // 1. Idempotency Check: return existing cached response if same key provided
    if (idempotencyKey) {
      const cached = db.prepare(
        'SELECT status_code, response_body FROM idempotency_keys WHERE key = ? AND user_id = ?'
      ).get(idempotencyKey, userId);

      if (cached) {
        try {
          const parsed = JSON.parse(cached.response_body);
          return res.status(cached.status_code).json({
            ...parsed,
            idempotentReplay: true
          });
        } catch (e) {
          // If parse fails, proceed
        }
      }
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      city,
      state,
      postalCode,
      demoPaymentMethod = 'Demo Simulated Payment'
    } = req.body;

    // Find user's cart
    const cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId);
    if (!cart) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items before checking out.'
      });
    }

    const cartItems = db.prepare(`
      SELECT ci.id as cart_item_id, ci.product_id, ci.quantity, p.name, p.price_paise, p.stock_quantity, p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
    `).all(cart.id);

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items before checking out.'
      });
    }

    // Atomic transaction for inventory deduction, order creation, and idempotency record
    const placeOrderTransaction = db.transaction(() => {
      // Stock check & total calculation using fresh database values
      let subtotalPaise = 0;
      for (const item of cartItems) {
        const freshProduct = db.prepare('SELECT id, name, price_paise, stock_quantity FROM products WHERE id = ?').get(item.product_id);
        
        if (!freshProduct) {
          throw new Error(`Product "${item.name}" is no longer available.`);
        }

        if (freshProduct.stock_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${freshProduct.name}". Only ${freshProduct.stock_quantity} available, but you requested ${item.quantity}.`
          );
        }

        subtotalPaise += item.quantity * freshProduct.price_paise;
      }

      const shippingPaise = subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_SHIPPING_PAISE;
      const totalPaise = subtotalPaise + shippingPaise;
      const orderNumber = generateOrderNumber();

      // Insert order
      const orderInsert = db.prepare(`
        INSERT INTO orders (
          order_number, user_id, customer_name, customer_email, customer_phone,
          shipping_address, city, state, postal_code,
          subtotal_paise, shipping_paise, total_paise,
          status, payment_method, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber,
        userId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        state,
        postalCode,
        subtotalPaise,
        shippingPaise,
        totalPaise,
        'Processing',
        demoPaymentMethod,
        'Paid - Demo (Simulated)'
      );

      const orderId = orderInsert.lastInsertRowid;

      // Insert order items & reduce product inventory
      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const reduceStock = db.prepare(`
        UPDATE products
        SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const item of cartItems) {
        const itemSubtotal = item.quantity * item.price_paise;
        insertOrderItem.run(
          orderId,
          item.product_id,
          item.name,
          item.price_paise,
          item.quantity,
          itemSubtotal,
          item.image_url
        );

        reduceStock.run(item.quantity, item.product_id);
      }

      // Empty cart items
      db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);

      // Fetch newly created order details to cache and return
      const orderDetails = getOrderWithItems(orderId);
      const responsePayload = {
        success: true,
        message: 'Order placed successfully! (Demo simulated payment confirmed)',
        data: orderDetails
      };

      // Store idempotency record inside transaction if key provided
      if (idempotencyKey) {
        db.prepare(`
          INSERT INTO idempotency_keys (key, user_id, status_code, response_body)
          VALUES (?, ?, ?, ?)
        `).run(idempotencyKey, userId, 201, JSON.stringify(responsePayload));
      }

      return {
        orderId,
        orderNumber,
        subtotalPaise,
        shippingPaise,
        totalPaise,
        responsePayload
      };
    });

    const orderResult = placeOrderTransaction();

    // Audit log order placement
    try {
      auditLogger.log({
        actorType: 'customer',
        actorId: String(userId),
        action: 'ORDER_PLACED',
        entityType: 'ORDER',
        entityId: String(orderResult.orderId),
        afterState: {
          orderNumber: orderResult.orderNumber,
          totalPaise: orderResult.totalPaise,
          status: 'Processing'
        },
        metadata: {
          idempotencyKey: idempotencyKey || null
        }
      });
    } catch (auditErr) {
      console.error('Audit log error on order checkout:', auditErr);
    }

    res.status(201).json(orderResult.responsePayload);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to place order.'
    });
  }
}

function getOrderWithItems(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const items = db.prepare(`
    SELECT id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
    FROM order_items
    WHERE order_id = ?
  `).all(orderId);

  return {
    ...order,
    items
  };
}

export function getUserOrders(req, res, next) {
  try {
    const userId = req.user.id;
    const orders = db.prepare(`
      SELECT o.*,
        (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS total_items
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);

    // Attach items to each order
    const ordersWithItems = orders.map((ord) => {
      const items = db.prepare(`
        SELECT id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
        FROM order_items
        WHERE order_id = ?
      `).all(ord.id);
      return {
        ...ord,
        items
      };
    });

    res.json({
      success: true,
      data: ordersWithItems
    });
  } catch (err) {
    next(err);
  }
}

export function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Ownership security check
    if (order.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this order.'
      });
    }

    const items = db.prepare(`
      SELECT id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
      FROM order_items
      WHERE order_id = ?
    `).all(order.id);

    res.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
  } catch (err) {
    next(err);
  }
}
