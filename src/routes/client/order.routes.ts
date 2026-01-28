import { Router } from 'express';
import { body } from 'express-validator';
import { createOrder } from '../../controllers/client/order.controller';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// POST create order (public - no authentication required for customers)
router.post(
  '/',
  [
    body('restaurantId').isString().notEmpty().withMessage('Restaurant ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required and must not be empty'),
    body('items.*.title').isString().notEmpty().withMessage('Item title is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('Item price must be a positive number'),
    body('totalPrice').isFloat({ min: 0 }).withMessage('Total price must be a positive number'),
    body('tableNumber').optional().isInt().withMessage('Table number must be an integer'),
    body('orderType').optional().isIn(['ON_TABLE', 'TAKE_AWAY']).withMessage('Order type must be ON_TABLE or TAKE_AWAY'),
  ],
  validateRequest,
  createOrder
);

export default router;
