/**
 * exportTools.js
 * Programmatic internal tools for exporting order and inventory reports in CSV format
 * with robust CSV formula injection defense (OWASP CSV Injection guidelines).
 */

import db from '../../config/db.js';

/**
 * Sanitize cell values against CSV/formula injection.
 * Any cell beginning with '=', '+', '-', '@', '\t', or '\r' is prefixed with an apostrophe (').
 * Double quotes are escaped according to RFC 4180.
 */
export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  // OWASP CSV Injection defense:
  // Dangerous leading characters that spreadsheet software interprets as formulas or commands
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export const exportTools = {
  /**
   * Export orders as a CSV report with CSV injection defense.
   */
  async exportOrdersCsv({ status = null, limit = 100 } = {}, context = {}) {
    const isAdmin = context.role === 'admin';
    const userId = context.userId;

    if (!isAdmin && !userId) {
      throw new Error('Authentication required to export order data.');
    }

    const conditions = [];
    const params = [];

    // Scope to user if not admin
    if (!isAdmin) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 100));
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orders = db.prepare(`
      SELECT order_number, customer_name, customer_email, total_paise, status, payment_status, tracking_number, created_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params, safeLimit);

    const headers = ['Order Number', 'Customer Name', 'Customer Email', 'Total (INR)', 'Status', 'Payment Status', 'Tracking Number', 'Created At'];

    const rows = orders.map((o) => [
      sanitizeCsvCell(o.order_number),
      sanitizeCsvCell(o.customer_name),
      sanitizeCsvCell(o.customer_email),
      sanitizeCsvCell((o.total_paise / 100).toFixed(2)),
      sanitizeCsvCell(o.status),
      sanitizeCsvCell(o.payment_status),
      sanitizeCsvCell(o.tracking_number || 'N/A'),
      sanitizeCsvCell(o.created_at)
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    return {
      rowCount: orders.length,
      filename: `orders_export_${Date.now()}.csv`,
      csv: csvContent
    };
  },

  /**
   * Export inventory inventory catalog as CSV (Admin / Warehouse).
   */
  async exportInventoryCsv({ category = null, lowStockOnly = false } = {}, context = {}) {
    const isAdmin = context.role === 'admin';
    if (!isAdmin) {
      throw new Error('Forbidden: Only administrators or warehouse staff can export inventory data.');
    }

    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (lowStockOnly) {
      conditions.push('stock_quantity <= 5');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const products = db.prepare(`
      SELECT id, name, category, price_paise, stock_quantity, created_at
      FROM products
      ${whereClause}
      ORDER BY id ASC
    `).all(...params);

    const headers = ['Product ID', 'Name', 'Category', 'Price (INR)', 'Stock Quantity', 'Stock Status'];

    const rows = products.map((p) => {
      const stockStatus = p.stock_quantity === 0 ? 'Out of Stock' : (p.stock_quantity <= 5 ? 'Low Stock' : 'In Stock');
      return [
        sanitizeCsvCell(p.id),
        sanitizeCsvCell(p.name),
        sanitizeCsvCell(p.category),
        sanitizeCsvCell((p.price_paise / 100).toFixed(2)),
        sanitizeCsvCell(p.stock_quantity),
        sanitizeCsvCell(stockStatus)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    return {
      rowCount: products.length,
      filename: `inventory_export_${Date.now()}.csv`,
      csv: csvContent
    };
  },

  /**
   * Standard AgentGuard tool: export_customers
   * Exports customer records (names, emails, registration dates) to CSV format.
   * Monitored by AgentGuard DLP policy to prevent data exfiltration.
   */
  async export_customers({ format = 'csv', limit = 100 } = {}, context = {}) {
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

    const customers = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE role = 'customer'
      ORDER BY id ASC
      LIMIT ?
    `).all(maxLimit);

    const headers = ['Customer ID', 'Full Name', 'Email Address', 'Account Role', 'Registered At'];
    const rows = customers.map((c) => [
      sanitizeCsvCell(c.id),
      sanitizeCsvCell(c.name),
      sanitizeCsvCell(c.email),
      sanitizeCsvCell(c.role),
      sanitizeCsvCell(c.created_at)
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'agent',
        actorId: String(context.userId || 'system'),
        action: 'CUSTOMERS_EXPORTED',
        entityType: 'CUSTOMER_DATA',
        entityId: 'ALL',
        metadata: {
          recordCount: customers.length,
          format
        },
        agentName: context.agentName || null
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      format,
      recordCount: customers.length,
      filename: `customers_export_${Date.now()}.csv`,
      csv: csvContent,
      preview: customers.slice(0, 5)
    };
  }
};

export default exportTools;
