import db from '../config/db.js';

export function getAdminMetrics(req, res, next) {
  try {
    const totalRevenuePaise = db.prepare(`
      SELECT coalesce(sum(total_paise), 0) AS total
      FROM orders
      WHERE status != 'Cancelled'
    `).get().total;

    const totalOrders = db.prepare('SELECT count(*) AS count FROM orders').get().count;
    const totalCustomers = db.prepare('SELECT count(*) AS count FROM users WHERE role = ?').get('customer').count;
    const totalProducts = db.prepare('SELECT count(*) AS count FROM products').get().count;
    const lowStockCount = db.prepare('SELECT count(*) AS count FROM products WHERE stock_quantity <= 5').get().count;

    const statusCounts = db.prepare(`
      SELECT status, count(*) AS count
      FROM orders
      GROUP BY status
    `).all();

    const recentOrders = db.prepare(`
      SELECT o.id, o.order_number, o.customer_name, o.total_paise, o.status, o.created_at,
        (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        totalRevenuePaise,
        totalOrders,
        totalCustomers,
        totalProducts,
        lowStockCount,
        statusCounts,
        recentOrders
      }
    });
  } catch (err) {
    next(err);
  }
}

export function getAllProducts(req, res, next) {
  try {
    const { search, category, sort = 'newest' } = req.query;
    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      conditions.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (category && category.trim() && category.toLowerCase() !== 'all') {
      conditions.push('category = ? COLLATE NOCASE');
      params.push(category.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let orderBy = 'ORDER BY created_at DESC';
    if (sort === 'stock_asc') orderBy = 'ORDER BY stock_quantity ASC';
    if (sort === 'stock_desc') orderBy = 'ORDER BY stock_quantity DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY price_paise ASC';
    if (sort === 'price_desc') orderBy = 'ORDER BY price_paise DESC';

    const products = db.prepare(`SELECT * FROM products ${whereClause} ${orderBy}`).all(...params);

    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    next(err);
  }
}

export function createProduct(req, res, next) {
  try {
    const {
      name,
      description,
      category,
      pricePaise,
      stockQuantity,
      imageUrl,
      featured = 0
    } = req.body;

    const info = db.prepare(`
      INSERT INTO products (name, description, category, price_paise, stock_quantity, image_url, rating, reviews_count, featured)
      VALUES (?, ?, ?, ?, ?, ?, 4.5, 0, ?)
    `).run(name, description, category, pricePaise, stockQuantity, imageUrl, featured ? 1 : 0);

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: created
    });
  } catch (err) {
    next(err);
  }
}

export function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      pricePaise,
      stockQuantity,
      imageUrl,
      featured
    } = req.body;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    db.prepare(`
      UPDATE products SET
        name = coalesce(?, name),
        description = coalesce(?, description),
        category = coalesce(?, category),
        price_paise = coalesce(?, price_paise),
        stock_quantity = coalesce(?, stock_quantity),
        image_url = coalesce(?, image_url),
        featured = coalesce(?, featured),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      description,
      category,
      pricePaise,
      stockQuantity,
      imageUrl,
      featured !== undefined ? (featured ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export function updateProductStock(req, res, next) {
  try {
    const { id } = req.params;
    const { stockQuantity } = req.body;

    const stock = parseInt(stockQuantity, 10);
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid non-negative stock quantity is required.'
      });
    }

    const result = db.prepare(`
      UPDATE products
      SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(stock, id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Stock updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    // Check if product is in any orders
    const hasOrders = db.prepare('SELECT count(*) as count FROM order_items WHERE product_id = ?').get(id).count > 0;
    if (hasOrders) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product because it is referenced in past customer orders. Consider setting its stock to 0 instead.'
      });
    }

    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

export function getAllOrders(req, res, next) {
  try {
    const { status, search } = req.query;
    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orders = db.prepare(`
      SELECT o.*,
        (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS total_items
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
    `).all(...params);

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

export function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // If transitioning to Cancelled from non-cancelled, restore inventory
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      const restoreStockTx = db.transaction(() => {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
        for (const item of items) {
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      });
      restoreStockTx();
    } else {
      db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    }

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

    res.json({
      success: true,
      message: `Order status updated to "${status}".`,
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
}
