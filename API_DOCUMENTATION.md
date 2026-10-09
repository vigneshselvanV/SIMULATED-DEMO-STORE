# ShopSphere REST API Documentation

ShopSphere is a full-stack e-commerce marketplace powered by Node.js, Express, and SQLite.
All prices are stored and calculated on the server in **integer paise** (1 INR = 100 paise; e.g. ₹1,499.00 = `149900` paise).
All authenticated sessions use secure, signed HTTP-only cookies (`shopsphere.sid`).

---

## Base URLs
- **Development API Base**: `http://localhost:5000/api`
- **Frontend Vite Client**: `http://localhost:5173` (with built-in `/api` proxy)

---

## Authentication Endpoints (`/api/auth`)

### 1. Register Account
- **Method**: `POST`
- **URL**: `/api/auth/register`
- **Rate Limit**: 30 requests / 15 minutes
- **Request Body**:
  ```json
  {
    "name": "Rahul Sharma",
    "email": "customer@shopsphere.com",
    "password": "Customer@123456"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Account registered successfully!",
    "user": {
      "id": 2,
      "name": "Rahul Sharma",
      "email": "customer@shopsphere.com",
      "role": "customer"
    }
  }
  ```

### 2. Login
- **Method**: `POST`
- **URL**: `/api/auth/login`
- **Rate Limit**: 30 requests / 15 minutes
- **Request Body**:
  ```json
  {
    "email": "customer@shopsphere.com",
    "password": "Customer@123456"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged in successfully!",
    "user": {
      "id": 2,
      "name": "Rahul Sharma",
      "email": "customer@shopsphere.com",
      "role": "customer"
    }
  }
  ```

### 3. Get Current User Session
- **Method**: `GET`
- **URL**: `/api/auth/me`
- **Response (200 OK - Authenticated)**:
  ```json
  {
    "success": true,
    "authenticated": true,
    "user": {
      "id": 2,
      "name": "Rahul Sharma",
      "email": "customer@shopsphere.com",
      "role": "customer",
      "createdAt": "2026-10-09T03:57:58.000Z"
    }
  }
  ```
- **Response (200 OK - Guest/Unauthenticated)**:
  ```json
  {
    "success": true,
    "authenticated": false,
    "user": null
  }
  ```

### 4. Logout
- **Method**: `POST`
- **URL**: `/api/auth/logout`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

## Products Catalog Endpoints (`/api/products`)

### 1. List Products & Search
- **Method**: `GET`
- **URL**: `/api/products`
- **Query Parameters**:
  - `search` *(optional)*: Text filter matched across title, description, category.
  - `category` *(optional)*: Filter by exact category (e.g. `Electronics`, `Fashion`, `Books`, `Accessories`, `Home Products`).
  - `minPrice` *(optional)*: Minimum price in integer paise.
  - `maxPrice` *(optional)*: Maximum price in integer paise.
  - `inStock` *(optional)*: `true` to filter items with stock > 0.
  - `featured` *(optional)*: `true` to filter highlighted products.
  - `sort` *(optional)*: `newest` (default), `price_asc`, `price_desc`, `rating_desc`, `reviews_desc`.
  - `page` *(optional)*: Page number (default: 1).
  - `limit` *(optional)*: Page limit (default: 50).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "UltraHD 4K Smart TV 55-Inch",
        "description": "Quantum Dot Display with Dolby Vision...",
        "category": "Electronics",
        "price_paise": 4499900,
        "stock_quantity": 15,
        "image_url": "https://images.unsplash.com/...",
        "rating": 4.7,
        "reviews_count": 128,
        "featured": 1,
        "created_at": "2026-10-09 03:57:58"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    }
  }
  ```

### 2. Product Details by ID
- **Method**: `GET`
- **URL**: `/api/products/:id`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 2,
      "name": "AcousticPro Wireless Noise Cancelling Headphones",
      "price_paise": 849900,
      "stock_quantity": 40,
      ...
    },
    "related": [ ... ]
  }
  ```

### 3. List Categories
- **Method**: `GET`
- **URL**: `/api/products/categories`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      { "category": "Accessories", "count": 5, "sample_image": "..." },
      { "category": "Books", "count": 5, "sample_image": "..." },
      { "category": "Electronics", "count": 5, "sample_image": "..." },
      { "category": "Fashion", "count": 5, "sample_image": "..." },
      { "category": "Home Products", "count": 5, "sample_image": "..." }
    ]
  }
  ```

---

## Shopping Cart Endpoints (`/api/cart`)

Works seamlessly for both authenticated users and guest sessions.

### 1. Get Current Cart
- **Method**: `GET`
- **URL**: `/api/cart`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "cartId": 1,
      "items": [
        {
          "cartItemId": 1,
          "productId": 2,
          "name": "AcousticPro ANC Headphones",
          "pricePaise": 849900,
          "quantity": 1,
          "subtotalPaise": 849900,
          "stockQuantity": 40,
          "imageUrl": "...",
          "isAvailable": true
        }
      ],
      "itemsCount": 1,
      "subtotalPaise": 849900,
      "shippingPaise": 0,
      "totalPaise": 849900,
      "freeShippingThresholdPaise": 50000,
      "hasOutOfStock": false
    }
  }
  ```

### 2. Add Item to Cart
- **Method**: `POST`
- **URL**: `/api/cart/items`
- **Request Body**:
  ```json
  {
    "productId": 2,
    "quantity": 1
  }
  ```

### 3. Update Item Quantity
- **Method**: `PUT`
- **URL**: `/api/cart/items/:id`
- **Request Body**:
  ```json
  {
    "quantity": 3
  }
  ```

### 4. Remove Item from Cart
- **Method**: `DELETE`
- **URL**: `/api/cart/items/:id`

### 5. Clear Entire Cart
- **Method**: `DELETE`
- **URL**: `/api/cart`

---

## Checkout & Orders Endpoints (`/api/orders`)
*Requires active customer session (`requireAuth`)*

### 1. Place Order (Atomic Transaction)
- **Method**: `POST`
- **URL**: `/api/orders/checkout`
- **Request Body**:
  ```json
  {
    "customerName": "Rahul Sharma",
    "customerEmail": "customer@shopsphere.com",
    "customerPhone": "+91 98765 43210",
    "shippingAddress": "Flat 402, Sunshine Residency, MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560001",
    "demoPaymentMethod": "Demo Simulated UPI"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Order placed successfully! (Demo simulated payment confirmed)",
    "data": {
      "id": 2,
      "order_number": "SPH-20261009-ABCDE",
      "subtotal_paise": 849900,
      "shipping_paise": 0,
      "total_paise": 849900,
      "status": "Processing",
      "payment_status": "Paid - Demo (Simulated)",
      "items": [ ... ]
    }
  }
  ```

### 2. User Order History
- **Method**: `GET`
- **URL**: `/api/orders`
- **Response (200 OK)**: Array of orders belonging exclusively to the logged-in user.

### 3. Order Details by ID
- **Method**: `GET`
- **URL**: `/api/orders/:id`
- **Authorization**: Enforces ownership check (403 Forbidden if accessing another customer's order).

---

## Admin Portal Endpoints (`/api/admin`)
*Requires administrator role session (`role === 'admin'`). Any customer or unauthenticated request receives `403 Forbidden` / `401 Unauthorized`.*

### 1. Sales & Catalog Metrics
- **Method**: `GET`
- **URL**: `/api/admin/metrics`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "totalRevenuePaise": 949800,
      "totalOrders": 1,
      "totalCustomers": 1,
      "totalProducts": 25,
      "lowStockCount": 0,
      "statusCounts": [ { "status": "Delivered", "count": 1 } ],
      "recentOrders": [ ... ]
    }
  }
  ```

### 2. Product Management (Admin Inventory)
- **`GET /api/admin/products`**: Full inventory list with stock counts.
- **`POST /api/admin/products`**: Add new product SKU.
  ```json
  {
    "name": "New Gaming Mouse",
    "description": "Ergonomic 16000 DPI sensor",
    "category": "Electronics",
    "priceRupees": 1999.00,
    "stockQuantity": 30,
    "imageUrl": "https://..."
  }
  ```
- **`PUT /api/admin/products/:id`**: Update product details.
- **`PATCH /api/admin/products/:id/stock`**: Update inventory stock count:
  ```json
  {
    "stockQuantity": 45
  }
  ```
- **`DELETE /api/admin/products/:id`**: Delete product SKU (protected if referenced in orders).

### 3. Order Lifecycle Management
- **`GET /api/admin/orders`**: View all orders with search & status filter.
- **`PUT /api/admin/orders/:id/status`**: Update order lifecycle:
  ```json
  {
    "status": "Shipped"
  }
  ```
  *(Status options: `Pending`, `Processing`, `Shipped`, `Delivered`, `Cancelled`)*
