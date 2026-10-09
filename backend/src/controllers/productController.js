import db from '../config/db.js';

export function getProducts(req, res, next) {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      featured,
      sort = 'newest',
      page = 1,
      limit = 50
    } = req.query;

    const conditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      conditions.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
      conditions.push('category = ? COLLATE NOCASE');
      params.push(category.trim());
    }

    if (minPrice !== undefined && !isNaN(parseInt(minPrice, 10))) {
      conditions.push('price_paise >= ?');
      params.push(parseInt(minPrice, 10));
    }

    if (maxPrice !== undefined && !isNaN(parseInt(maxPrice, 10))) {
      conditions.push('price_paise <= ?');
      params.push(parseInt(maxPrice, 10));
    }

    if (inStock === 'true' || inStock === '1') {
      conditions.push('stock_quantity > 0');
    }

    if (featured === 'true' || featured === '1') {
      conditions.push('featured = 1');
    }

    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY created_at DESC';
    if (sort === 'price_asc') {
      orderBy = 'ORDER BY price_paise ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'ORDER BY price_paise DESC';
    } else if (sort === 'rating_desc') {
      orderBy = 'ORDER BY rating DESC';
    } else if (sort === 'reviews_desc') {
      orderBy = 'ORDER BY reviews_count DESC';
    } else if (sort === 'newest') {
      orderBy = 'ORDER BY created_at DESC';
    }

    const countSql = `SELECT count(*) as total FROM products ${whereClause}`;
    const totalCount = db.prepare(countSql).get(...params).total;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

    const sql = `
      SELECT id, name, description, category, price_paise, stock_quantity, image_url, rating, reviews_count, featured, created_at
      FROM products
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const products = db.prepare(sql).all(...params, parsedLimit, offset);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = db.prepare(`
      SELECT id, name, description, category, price_paise, stock_quantity, image_url, rating, reviews_count, featured, created_at
      FROM products
      WHERE id = ?
    `).get(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Get related products in the same category
    const relatedProducts = db.prepare(`
      SELECT id, name, category, price_paise, stock_quantity, image_url, rating, reviews_count
      FROM products
      WHERE category = ? AND id != ?
      ORDER BY rating DESC
      LIMIT 4
    `).all(product.category, product.id);

    res.json({
      success: true,
      data: product,
      related: relatedProducts
    });
  } catch (err) {
    next(err);
  }
}

export function getCategories(req, res, next) {
  try {
    const categories = db.prepare(`
      SELECT category, count(*) as count, min(image_url) as sample_image
      FROM products
      GROUP BY category
      ORDER BY category ASC
    `).all();

    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    next(err);
  }
}
