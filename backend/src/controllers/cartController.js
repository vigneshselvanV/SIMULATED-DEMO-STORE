import db from '../config/db.js';

// Shipping policy: Free shipping above ₹500 (50,000 paise), else ₹49 (4,900 paise)
const FREE_SHIPPING_THRESHOLD_PAISE = 50000;
const STANDARD_SHIPPING_PAISE = 4900;

function getOrCreateCart(req) {
  const sessionId = req.sessionID;
  const userId = req.user ? req.user.id : null;

  let cart = null;

  if (userId) {
    cart = db.prepare('SELECT id, session_id, user_id FROM carts WHERE user_id = ?').get(userId);
  }

  if (!cart && sessionId) {
    cart = db.prepare('SELECT id, session_id, user_id FROM carts WHERE session_id = ?').get(sessionId);
    if (cart && userId) {
      db.prepare('UPDATE carts SET user_id = ? WHERE id = ?').run(userId, cart.id);
      cart.user_id = userId;
    }
  }

  if (!cart) {
    const info = db.prepare('INSERT INTO carts (session_id, user_id) VALUES (?, ?)').run(sessionId, userId);
    cart = {
      id: info.lastInsertRowid,
      session_id: sessionId,
      user_id: userId
    };
  }

  return cart;
}

function fetchFormattedCart(cartId) {
  const items = db.prepare(`
    SELECT
      ci.id AS cart_item_id,
      ci.product_id,
      ci.quantity,
      p.name,
      p.description,
      p.category,
      p.price_paise,
      p.stock_quantity,
      p.image_url
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ?
    ORDER BY ci.created_at ASC
  `).all(cartId);

  let subtotalPaise = 0;
  let totalItemsCount = 0;
  let hasOutOfStock = false;

  const formattedItems = items.map((item) => {
    const itemSubtotal = item.quantity * item.price_paise;
    subtotalPaise += itemSubtotal;
    totalItemsCount += item.quantity;

    const isAvailable = item.stock_quantity >= item.quantity;
    if (!isAvailable) {
      hasOutOfStock = true;
    }

    return {
      cartItemId: item.cart_item_id,
      productId: item.product_id,
      name: item.name,
      category: item.category,
      pricePaise: item.price_paise,
      quantity: item.quantity,
      subtotalPaise: itemSubtotal,
      stockQuantity: item.stock_quantity,
      imageUrl: item.image_url,
      isAvailable,
      availableStock: item.stock_quantity
    };
  });

  const shippingPaise = totalItemsCount === 0
    ? 0
    : (subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_SHIPPING_PAISE);

  const totalPaise = subtotalPaise + shippingPaise;

  return {
    cartId,
    items: formattedItems,
    itemsCount: totalItemsCount,
    subtotalPaise,
    shippingPaise,
    totalPaise,
    freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
    hasOutOfStock
  };
}

export function getCart(req, res, next) {
  try {
    const cart = getOrCreateCart(req);
    const cartData = fetchFormattedCart(cart.id);
    res.json({
      success: true,
      data: cartData
    });
  } catch (err) {
    next(err);
  }
}

export function addToCart(req, res, next) {
  try {
    const { productId, quantity } = req.body;
    const cart = getOrCreateCart(req);

    // Validate product existence and stock
    const product = db.prepare('SELECT id, name, stock_quantity, price_paise FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (product.stock_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `"${product.name}" is currently out of stock.`
      });
    }

    const existingItem = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?')
      .get(cart.id, productId);

    const targetQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (targetQuantity > product.stock_quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot add more than ${product.stock_quantity} units of "${product.name}". You already have ${existingItem?.quantity || 0} in your cart.`
      });
    }

    if (existingItem) {
      db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(targetQuantity, existingItem.id);
    } else {
      db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)')
        .run(cart.id, productId, targetQuantity);
    }

    const updatedCart = fetchFormattedCart(cart.id);
    res.json({
      success: true,
      message: `"${product.name}" added to cart.`,
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

export function updateCartItem(req, res, next) {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const cart = getOrCreateCart(req);

    const cartItem = db.prepare(`
      SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity, p.name, p.stock_quantity
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ? AND ci.cart_id = ?
    `).get(id, cart.id);

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    const newQty = parseInt(quantity, 10);
    if (newQty <= 0) {
      db.prepare('DELETE FROM cart_items WHERE id = ?').run(cartItem.id);
    } else {
      if (newQty > cartItem.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${cartItem.stock_quantity} units available in stock for "${cartItem.name}".`
        });
      }
      db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newQty, cartItem.id);
    }

    const updatedCart = fetchFormattedCart(cart.id);
    res.json({
      success: true,
      message: 'Cart updated.',
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

export function removeCartItem(req, res, next) {
  try {
    const { id } = req.params;
    const cart = getOrCreateCart(req);

    const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(id, cart.id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    const updatedCart = fetchFormattedCart(cart.id);
    res.json({
      success: true,
      message: 'Item removed from cart.',
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}

export function clearCart(req, res, next) {
  try {
    const cart = getOrCreateCart(req);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);

    const updatedCart = fetchFormattedCart(cart.id);
    res.json({
      success: true,
      message: 'Cart cleared.',
      data: updatedCart
    });
  } catch (err) {
    next(err);
  }
}
