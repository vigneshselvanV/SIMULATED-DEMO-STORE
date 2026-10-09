const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(req, res, next) {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Full name is required and must be at least 2 characters long.'
    });
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'A valid email address is required.'
    });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long.'
    });
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Password is required.'
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

export function validateCartItem(req, res, next) {
  const { productId, quantity } = req.body;

  const parsedProductId = parseInt(productId, 10);
  const parsedQuantity = parseInt(quantity, 10);

  if (isNaN(parsedProductId) || parsedProductId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid product ID.'
    });
  }

  if (isNaN(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 50) {
    return res.status(400).json({
      success: false,
      message: 'Quantity must be a positive integer between 1 and 50.'
    });
  }

  req.body.productId = parsedProductId;
  req.body.quantity = parsedQuantity;
  next();
}

export function validateCheckout(req, res, next) {
  const {
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    city,
    state,
    postalCode
  } = req.body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Valid customer name is required.' });
  }

  if (!customerEmail || typeof customerEmail !== 'string' || !EMAIL_REGEX.test(customerEmail.trim())) {
    return res.status(400).json({ success: false, message: 'Valid email address is required.' });
  }

  if (!customerPhone || typeof customerPhone !== 'string' || customerPhone.trim().length < 7) {
    return res.status(400).json({ success: false, message: 'Valid contact phone number is required.' });
  }

  if (!shippingAddress || typeof shippingAddress !== 'string' || shippingAddress.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Shipping street address is required.' });
  }

  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'City is required.' });
  }

  if (!state || typeof state !== 'string' || state.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'State / Province is required.' });
  }

  if (!postalCode || typeof postalCode !== 'string' || postalCode.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Postal / PIN code is required.' });
  }

  req.body.customerName = customerName.trim();
  req.body.customerEmail = customerEmail.trim().toLowerCase();
  req.body.customerPhone = customerPhone.trim();
  req.body.shippingAddress = shippingAddress.trim();
  req.body.city = city.trim();
  req.body.state = state.trim();
  req.body.postalCode = postalCode.trim();
  if (req.body.idempotencyKey && typeof req.body.idempotencyKey === 'string') {
    req.body.idempotencyKey = req.body.idempotencyKey.trim().slice(0, 128);
  }
  next();
}

export function validateProductPayload(req, res, next) {
  const { name, description, category, pricePaise, priceRupees, stockQuantity, imageUrl } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Product description is required.' });
  }

  if (!category || typeof category !== 'string' || category.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Category is required.' });
  }

  // Allow price to be passed as pricePaise or priceRupees for flexibility
  let finalPaise = null;
  if (pricePaise !== undefined && pricePaise !== null) {
    finalPaise = parseInt(pricePaise, 10);
  } else if (priceRupees !== undefined && priceRupees !== null) {
    finalPaise = Math.round(parseFloat(priceRupees) * 100);
  }

  if (finalPaise === null || isNaN(finalPaise) || finalPaise < 0) {
    return res.status(400).json({ success: false, message: 'Price must be a valid positive number.' });
  }

  const stock = parseInt(stockQuantity, 10);
  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ success: false, message: 'Stock quantity must be a non-negative integer.' });
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Product image URL is required.' });
  }

  req.body.name = name.trim();
  req.body.description = description.trim();
  req.body.category = category.trim();
  req.body.pricePaise = finalPaise;
  req.body.stockQuantity = stock;
  req.body.imageUrl = imageUrl.trim();
  next();
}
