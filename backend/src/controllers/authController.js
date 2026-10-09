import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import auditLogger from '../services/auditLogger.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, passwordHash, 'customer');

    const newUser = {
      id: info.lastInsertRowid,
      name,
      email,
      role: 'customer'
    };

    // Regenerate session to prevent session fixation attacks
    const prevSessionId = req.sessionID;
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.userId = newUser.id;

      // Link guest cart to user with new session ID atomically
      if (prevSessionId) {
        try {
          db.prepare('UPDATE carts SET user_id = ?, session_id = ? WHERE session_id = ? AND user_id IS NULL')
            .run(newUser.id, req.sessionID, prevSessionId);
        } catch (cartErr) {
          console.error('Error linking cart on registration:', cartErr);
        }
      }

      // Record audit log
      try {
        auditLogger.log({
          actorType: 'customer',
          actorId: String(newUser.id),
          action: 'USER_REGISTERED',
          entityType: 'USER',
          entityId: String(newUser.id),
          afterState: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
      } catch (auditErr) {
        console.error('Audit log error on register:', auditErr);
      }

      res.status(201).json({
        success: true,
        message: 'Account registered successfully!',
        user: newUser
      });
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Regenerate session to prevent session fixation
    const prevSessionId = req.sessionID;
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.userId = user.id;

      // Migrate guest cart items from prevSessionId if any
      try {
        const guestCart = db.prepare('SELECT id FROM carts WHERE session_id = ?').get(prevSessionId);
        let userCart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(user.id);

        if (guestCart && (!userCart || userCart.id === guestCart.id)) {
          db.prepare('UPDATE carts SET user_id = ?, session_id = ? WHERE id = ?')
            .run(user.id, req.sessionID, guestCart.id);
        } else if (guestCart && userCart && userCart.id !== guestCart.id) {
          // Merge items from guestCart into userCart atomically
          const mergeTx = db.transaction(() => {
            const guestItems = db.prepare('SELECT product_id, quantity FROM cart_items WHERE cart_id = ?').all(guestCart.id);
            for (const item of guestItems) {
              const existingItem = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?')
                .get(userCart.id, item.product_id);
              if (existingItem) {
                db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?')
                  .run(item.quantity, existingItem.id);
              } else {
                db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)')
                  .run(userCart.id, item.product_id, item.quantity);
              }
            }
            db.prepare('DELETE FROM carts WHERE id = ?').run(guestCart.id);
          });
          mergeTx();
        }
      } catch (cartErr) {
        console.error('Error migrating cart on login:', cartErr);
      }

      try {
        auditLogger.log({
          actorType: user.role === 'admin' ? 'admin' : 'customer',
          actorId: String(user.id),
          action: 'USER_LOGGED_IN',
          entityType: 'SESSION',
          entityId: req.sessionID,
          afterState: { userId: user.id, email: user.email, role: user.role }
        });
      } catch (auditErr) {
        console.error('Audit log error on login:', auditErr);
      }

      res.json({
        success: true,
        message: 'Logged in successfully!',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res, next) {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('shopsphere.sid');
      return res.json({
        success: true,
        message: 'Logged out successfully.'
      });
    });
  } else {
    res.json({
      success: true,
      message: 'Already logged out.'
    });
  }
}

export function getCurrentUser(req, res) {
  if (req.user) {
    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.created_at
      }
    });
  }

  res.json({
    success: true,
    authenticated: false,
    user: null
  });
}
