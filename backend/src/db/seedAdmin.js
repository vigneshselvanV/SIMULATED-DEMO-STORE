import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { initializeDatabase } from './initDb.js';

export function createAdminAccount(email = 'admin@shopsphere.com', password = 'Admin@123456', name = 'ShopSphere Administrator') {
  initializeDatabase();

  const existing = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
  const passwordHash = bcrypt.hashSync(password, 10);

  if (existing) {
    db.prepare('UPDATE users SET role = ?, password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('admin', passwordHash, name, existing.id);
    console.log(`Admin user [${email}] updated successfully.`);
    return { id: existing.id, email, name, role: 'admin' };
  } else {
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, passwordHash, 'admin');
    console.log(`Admin user [${email}] created successfully with ID ${info.lastInsertRowid}.`);
    return { id: info.lastInsertRowid, email, name, role: 'admin' };
  }
}

// Support CLI execution: npm run seed:admin -- <email> <password> <name>
if (process.argv[1] && process.argv[1].endsWith('seedAdmin.js')) {
  const customEmail = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@shopsphere.com';
  const customPass = process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin@123456';
  const customName = process.argv[4] || process.env.ADMIN_NAME || 'ShopSphere Administrator';

  try {
    createAdminAccount(customEmail, customPass, customName);
    console.log('Administrator setup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create administrator:', err);
    process.exit(1);
  }
}
