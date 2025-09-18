import { Router } from 'express';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import {
  getRestaurantPayments,
  getRestaurantPaymentStats,
} from '../../controllers/restaurant/payments.controller';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();

// Apply authentication and restaurant ownership middleware to all routes
router.use(authenticateUser);
router.use(verifyRestaurantOwnership);

// Get restaurant payments with filtering and pagination
router.get('/', getRestaurantPayments);

// Get restaurant payment statistics
router.get('/stats', getRestaurantPaymentStats);

export default router;
