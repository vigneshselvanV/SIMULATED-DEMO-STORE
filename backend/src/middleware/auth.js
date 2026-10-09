import db from '../config/db.js';

export function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        delete req.session.userId;
      }
    } catch (err) {
      console.error('Error attaching user to request:', err);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to proceed.'
    });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in as an administrator.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden. Administrator privileges are required.'
    });
  }

  next();
}
