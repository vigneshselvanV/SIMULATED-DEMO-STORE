import { Router } from 'express';
import {
  getAdminMetrics,
  getAllProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
  getAllOrders,
  updateOrderStatus
} from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateProductPayload } from '../middleware/validate.js';

const router = Router();

// Protect ALL admin routes on the server side
router.use(requireAdmin);

// Dashboard metrics
router.get('/metrics', getAdminMetrics);

// Product management
router.get('/products', getAllProducts);
router.post('/products', validateProductPayload, createProduct);
router.put('/products/:id', updateProduct);
router.patch('/products/:id/stock', updateProductStock);
router.delete('/products/:id', deleteProduct);

// Order management
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

export default router;
