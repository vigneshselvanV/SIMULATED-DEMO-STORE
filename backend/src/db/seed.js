import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { initializeDatabase } from './initDb.js';
import { createAdminAccount } from './seedAdmin.js';

export function seedDatabase() {
  initializeDatabase();

  console.log('Seeding ShopSphere database...');

  // 1. Seed Admin and Customer
  createAdminAccount('admin@shopsphere.com', 'Admin@123456', 'ShopSphere Administrator');

  const customerPass = bcrypt.hashSync('Customer@123456', 10);
  const existingCust = db.prepare('SELECT id FROM users WHERE email = ?').get('customer@shopsphere.com');
  let customerId = existingCust?.id;

  if (!existingCust) {
    const custInfo = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Rahul Sharma', 'customer@shopsphere.com', customerPass, 'customer');
    customerId = custInfo.lastInsertRowid;
    console.log('Sample customer created (customer@shopsphere.com / Customer@123456).');
  }

  // 2. Sample Products across 5 categories with prices in integer paise
  const products = [
    // Electronics
    {
      name: 'UltraHD 4K Smart TV 55-Inch',
      description: 'Quantum Dot Display with Dolby Vision, Atmos, HDR10+, hands-free voice control, and dual-band WiFi for immersive home entertainment.',
      category: 'Electronics',
      price_paise: 4499900, // ₹44,999.00
      stock_quantity: 15,
      image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80',
      rating: 4.7,
      reviews_count: 128,
      featured: 1
    },
    {
      name: 'AcousticPro Wireless Noise Cancelling Headphones',
      description: 'Active Noise Cancelling over-ear headphones with 40-hour battery life, quick charge, multipoint Bluetooth pairing, and ultra-comfortable ear cushions.',
      category: 'Electronics',
      price_paise: 849900, // ₹8,499.00
      stock_quantity: 40,
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      rating: 4.8,
      reviews_count: 312,
      featured: 1
    },
    {
      name: 'Zenith Pro 14-Inch Ultrabook Laptop',
      description: 'Intel Core i7 13th Gen, 16GB LPDDR5 RAM, 1TB NVMe SSD, 2.8K 90Hz OLED display, and all-day 14-hour battery encased in magnesium alloy.',
      category: 'Electronics',
      price_paise: 6250000, // ₹62,500.00
      stock_quantity: 12,
      image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
      rating: 4.6,
      reviews_count: 89,
      featured: 1
    },
    {
      name: 'Apex Pulse AMOLED Smartwatch',
      description: '1.43-inch Always-On AMOLED screen, continuous SpO2 and heart-rate monitoring, 100+ workout modes, Bluetooth calling, and 5ATM water resistance.',
      category: 'Electronics',
      price_paise: 399900, // ₹3,999.00
      stock_quantity: 55,
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      rating: 4.4,
      reviews_count: 240,
      featured: 0
    },
    {
      name: 'HyperStrike Mechanical Gaming Keyboard RGB',
      description: 'Hot-swappable tactile blue switches, per-key RGB backlighting, aluminum top plate, and detachable braided USB-C cable for gamers and typists.',
      category: 'Electronics',
      price_paise: 299900, // ₹2,999.00
      stock_quantity: 25,
      image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      rating: 4.5,
      reviews_count: 75,
      featured: 0
    },

    // Fashion
    {
      name: 'Heritage Denim Trucker Jacket',
      description: 'Classic vintage-wash denim jacket made from 100% heavyweight cotton with metal shank buttons, dual chest pockets, and relaxed tailored fit.',
      category: 'Fashion',
      price_paise: 249900, // ₹2,499.00
      stock_quantity: 35,
      image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
      rating: 4.3,
      reviews_count: 92,
      featured: 1
    },
    {
      name: 'Organic Combed Cotton Crewneck T-Shirt',
      description: 'Super-soft 180 GSM combed organic cotton t-shirt with bio-washed finish, ribbed collar, and pre-shrunk fabric for lasting comfort.',
      category: 'Fashion',
      price_paise: 69900, // ₹699.00
      stock_quantity: 80,
      image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      rating: 4.5,
      reviews_count: 180,
      featured: 0
    },
    {
      name: 'Velocity Cloud Running Sneakers',
      description: 'Breathable engineered mesh upper with responsive cushioned EVA midsole, grippy rubber outsole, and lightweight ergonomic arch support.',
      category: 'Fashion',
      price_paise: 329900, // ₹3,299.00
      stock_quantity: 30,
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      rating: 4.6,
      reviews_count: 114,
      featured: 1
    },
    {
      name: 'Aviator Polarized UV400 Sunglasses',
      description: 'Timeless gold metal frame with polarized green-tinted lenses, 100% UV400 protection, and anti-glare scratch-resistant coating.',
      category: 'Fashion',
      price_paise: 119900, // ₹1,199.00
      stock_quantity: 45,
      image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
      rating: 4.4,
      reviews_count: 67,
      featured: 0
    },
    {
      name: 'Tailored Slim Fit Chino Trousers',
      description: 'Stretch cotton blend chinos designed for effortless versatility from office meetings to weekend outings, featuring deep pockets and durable zip fly.',
      category: 'Fashion',
      price_paise: 159900, // ₹1,599.00
      stock_quantity: 50,
      image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80',
      rating: 4.2,
      reviews_count: 48,
      featured: 0
    },

    // Books
    {
      name: 'Clean Code: Handbook of Agile Software Craftsmanship',
      description: 'By Robert C. Martin. Learn the software craftsman principles, best practices of writing readable, maintainable, and elegant object-oriented code.',
      category: 'Books',
      price_paise: 99900, // ₹999.00
      stock_quantity: 60,
      image_url: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80',
      rating: 4.9,
      reviews_count: 520,
      featured: 1
    },
    {
      name: 'The Psychology of Money',
      description: 'By Morgan Housel. Timeless lessons on wealth, greed, and happiness exploring how people think about money and behavioral finance.',
      category: 'Books',
      price_paise: 39900, // ₹399.00
      stock_quantity: 100,
      image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      rating: 4.8,
      reviews_count: 840,
      featured: 0
    },
    {
      name: 'Atomic Habits: Tiny Changes, Remarkable Results',
      description: 'By James Clear. An easy, proven framework for improving every day through compounding small habits and behavioral psychology.',
      category: 'Books',
      price_paise: 49900, // ₹499.00
      stock_quantity: 90,
      image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80',
      rating: 4.9,
      reviews_count: 1250,
      featured: 1
    },
    {
      name: 'Designing Data-Intensive Applications',
      description: 'By Martin Kleppmann. The definitive guide to the architecture of modern distributed data systems, databases, streams, and storage engines.',
      category: 'Books',
      price_paise: 149900, // ₹1,499.00
      stock_quantity: 40,
      image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
      rating: 4.9,
      reviews_count: 310,
      featured: 0
    },
    {
      name: 'Deep Work: Rules for Focused Success in a Distracted World',
      description: 'By Cal Newport. Master the superpower of intense concentration without distraction in an increasingly complex and noisy modern economy.',
      category: 'Books',
      price_paise: 45000, // ₹450.00
      stock_quantity: 50,
      image_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
      rating: 4.7,
      reviews_count: 290,
      featured: 0
    },

    // Accessories
    {
      name: 'Genuine Full-Grain Leather RFID Wallet',
      description: 'Handcrafted bifold wallet with built-in RFID blocking shield, 8 card slots, quick-access thumb slider, and dual currency compartments.',
      category: 'Accessories',
      price_paise: 89900, // ₹899.00
      stock_quantity: 65,
      image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
      rating: 4.6,
      reviews_count: 155,
      featured: 1
    },
    {
      name: 'Water-Resistant Commuter Backpack 25L',
      description: 'High-density Oxford fabric backpack featuring padded 15.6-inch laptop compartment, hidden anti-theft pocket, and USB charging pass-through.',
      category: 'Accessories',
      price_paise: 189900, // ₹1,899.00
      stock_quantity: 45,
      image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      rating: 4.7,
      reviews_count: 210,
      featured: 1
    },
    {
      name: 'Stainless Steel Insulated Travel Tumbler 750ml',
      description: 'Double-wall vacuum insulation keeps beverages hot for 12 hours or ice-cold for 24 hours. Leak-proof flip lid with silicone seal and car cup holder fit.',
      category: 'Accessories',
      price_paise: 74900, // ₹749.00
      stock_quantity: 85,
      image_url: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80',
      rating: 4.5,
      reviews_count: 98,
      featured: 0
    },
    {
      name: 'Magnetic 3-in-1 Fast Wireless Charging Station',
      description: 'Foldable MagSafe compatible wireless dock charges smartphone, smartwatch, and earbuds simultaneously with intelligent temperature control.',
      category: 'Accessories',
      price_paise: 199900, // ₹1,999.00
      stock_quantity: 30,
      image_url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=800&q=80',
      rating: 4.3,
      reviews_count: 84,
      featured: 0
    },
    {
      name: 'Minimalist Waxed Canvas Messenger Bag',
      description: 'Heavyweight waxed canvas bag with brass hardware, adjustable shoulder strap, internal organizer pockets, and magnetic buckle closures.',
      category: 'Accessories',
      price_paise: 129900, // ₹1,299.00
      stock_quantity: 25,
      image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      rating: 4.4,
      reviews_count: 62,
      featured: 0
    },

    // Home Products
    {
      name: 'Smart Ambient LED Desk Lamp',
      description: 'Dimmable color temperature control (2700K - 6500K), touch slider, eye-care flicker-free illumination, timer, and wireless phone charging pad base.',
      category: 'Home Products',
      price_paise: 179900, // ₹1,799.00
      stock_quantity: 38,
      image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
      rating: 4.5,
      reviews_count: 104,
      featured: 0
    },
    {
      name: 'Ultrasonic Essential Oil Aroma Diffuser 500ml',
      description: 'Whisper-quiet cool mist humidifier with 7 soothing ambient LED light colors, 4 timer settings, and automatic waterless shut-off safety protection.',
      category: 'Home Products',
      price_paise: 124900, // ₹1,249.00
      stock_quantity: 42,
      image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80',
      rating: 4.6,
      reviews_count: 147,
      featured: 1
    },
    {
      name: 'Ergonomic High-Back Office Chair with Lumbar Support',
      description: 'Breathable mesh backrest, adjustable 3D armrests, dynamic lumbar support, tilt-lock recline mechanism, and heavy-duty smooth rolling casters.',
      category: 'Home Products',
      price_paise: 999900, // ₹9,999.00
      stock_quantity: 18,
      image_url: 'https://images.unsplash.com/photo-1580481077112-7010488663b6?auto=format&fit=crop&w=800&q=80',
      rating: 4.7,
      reviews_count: 76,
      featured: 1
    },
    {
      name: 'Tri-Ply Stainless Steel Cookware Set (3 Pieces)',
      description: 'Includes 24cm Frying Pan, 20cm Saucepan with glass lid, and 24cm Kadhai. Uniform heat distribution, induction and gas stove compatible.',
      category: 'Home Products',
      price_paise: 349900, // ₹3,499.00
      stock_quantity: 22,
      image_url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
      rating: 4.8,
      reviews_count: 63,
      featured: 0
    },
    {
      name: 'Memory Foam Contour Cervical Pillow',
      description: 'Slow-rebound orthopedic memory foam pillow ergonomically contoured for neck pain relief, spine alignment, with washable bamboo fiber cover.',
      category: 'Home Products',
      price_paise: 119900, // ₹1,199.00
      stock_quantity: 50,
      image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
      rating: 4.4,
      reviews_count: 88,
      featured: 0
    }
  ];

  // Insert or update products
  const checkProductStmt = db.prepare('SELECT id FROM products WHERE name = ?');
  const insertProductStmt = db.prepare(`
    INSERT INTO products (name, description, category, price_paise, stock_quantity, image_url, rating, reviews_count, featured)
    VALUES (@name, @description, @category, @price_paise, @stock_quantity, @image_url, @rating, @reviews_count, @featured)
  `);
  const updateProductStmt = db.prepare(`
    UPDATE products SET
      description = @description,
      category = @category,
      price_paise = @price_paise,
      stock_quantity = @stock_quantity,
      image_url = @image_url,
      rating = @rating,
      reviews_count = @reviews_count,
      featured = @featured,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const insertAll = db.transaction((prods) => {
    let inserted = 0;
    let updated = 0;
    for (const prod of prods) {
      const existing = checkProductStmt.get(prod.name);
      if (existing) {
        updateProductStmt.run({ ...prod, id: existing.id });
        updated++;
      } else {
        insertProductStmt.run(prod);
        inserted++;
      }
    }
    return { inserted, updated };
  });

  const stats = insertAll(products);
  console.log(`Products seeded: ${stats.inserted} created, ${stats.updated} updated.`);

  // 3. Seed a sample completed order for the demo customer to demonstrate order history
  const existingOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?').get('SPH-DEMO-1001');
  if (!existingOrder && customerId) {
    const createSampleOrder = db.transaction(() => {
      const orderInfo = db.prepare(`
        INSERT INTO orders (
          order_number, user_id, customer_name, customer_email, customer_phone,
          shipping_address, city, state, postal_code,
          subtotal_paise, shipping_paise, total_paise, status, payment_method, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'SPH-DEMO-1001',
        customerId,
        'Rahul Sharma',
        'customer@shopsphere.com',
        '+91 98765 43210',
        'Flat 402, Sunshine Apartments, MG Road',
        'Bengaluru',
        'Karnataka',
        '560001',
        949800, // ₹9,498.00 (Headphones ₹8499 + Book ₹999)
        0,      // Free shipping
        949800,
        'Delivered',
        'Demo Simulated Payment',
        'Paid - Demo'
      );

      const orderId = orderInfo.lastInsertRowid;

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        2, // Headphones
        'AcousticPro Wireless Noise Cancelling Headphones',
        849900,
        1,
        849900,
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
      );

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        11, // Clean code
        'Clean Code: Handbook of Agile Software Craftsmanship',
        99900,
        1,
        99900,
        'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80'
      );
    });

    createSampleOrder();
    console.log('Sample demo order created: SPH-DEMO-1001');
  }

  console.log('Database seeding finished successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}
