import { Router } from 'express';
import { param, body, query } from 'express-validator';
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
} from '../../controllers/restaurant/orders.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import { canManageOrders } from '../../middlewares/permissions';

const router = Router();

// All routes require authentication and restaurant ownership
router.use(authenticateUser);
router.use(verifyRestaurantOwnership);
router.use(canManageOrders);

// GET all orders
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getOrders
);

// GET order by ID
router.get(
  '/:orderId',
  [param('orderId').isInt().withMessage('Order ID must be an integer')],
  validateRequest,
  getOrderById
);

// PUT update order status
router.put(
  '/:orderId/status',
  [
    param('orderId').isInt().withMessage('Order ID must be an integer'),
    body('status')
      .isIn(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  updateOrderStatus
);

export default router;
