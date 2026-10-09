import { Router } from 'express';
import { createOrder, getUserOrders, getOrderById } from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateCheckout } from '../middleware/validate.js';

const router = Router();

// All order endpoints require authenticated user session
router.use(requireAuth);

router.post('/checkout', validateCheckout, createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);

export default router;
