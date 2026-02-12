import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import {
  createCheckoutSession,
  confirmCheckoutSession,
  confirmPayPalCheckout,
} from '../../controllers/restaurant/subscription.controller';
import { body } from 'express-validator';

const router = Router();

// Create checkout session (Stripe or PayPal via provider)
router.post(
  '/checkout',
  authenticateUser,
  body('planId').isInt({ gt: 0 }),
  body('provider').optional().isIn(['stripe', 'paypal']),
  validateRequest,
  createCheckoutSession,
);

// Confirm Stripe after redirect
router.post(
  '/confirm',
  authenticateUser,
  body('sessionId').isString().notEmpty(),
  validateRequest,
  confirmCheckoutSession,
);

// Confirm PayPal after redirect (orderId = token from PayPal return URL)
router.post(
  '/confirm-paypal',
  authenticateUser,
  body('orderId').isString().notEmpty(),
  validateRequest,
  confirmPayPalCheckout,
);

// Webhook endpoint moved to app.ts to ensure raw body parsing

export default router;
