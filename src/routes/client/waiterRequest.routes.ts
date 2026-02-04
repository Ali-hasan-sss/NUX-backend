import { Router } from 'express';
import { body } from 'express-validator';
import { requestWaiter } from '../../controllers/client/waiterRequest.controller';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// POST request waiter (public - no auth, customer at table)
router.post(
  '/',
  [
    body('restaurantId').isString().notEmpty().withMessage('Restaurant ID is required'),
    body('tableNumber').isInt({ min: 1 }).withMessage('Table number must be a positive integer'),
  ],
  validateRequest,
  requestWaiter,
);

export default router;
