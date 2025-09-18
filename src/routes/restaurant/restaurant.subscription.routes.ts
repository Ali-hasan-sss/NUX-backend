import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import {
  createCheckoutSession,
  confirmCheckoutSession,
} from '../../controllers/restaurant/subscription.controller';
import { body } from 'express-validator';

const router = Router();

// Create Stripe checkout session for recurring subscription
router.post(
  '/checkout',
  authenticateUser,
  body('planId').isInt({ gt: 0 }),
  validateRequest,
  createCheckoutSession,
);

// Confirm after redirect
router.post(
  '/confirm',
  authenticateUser,
  body('sessionId').isString().notEmpty(),
  validateRequest,
  confirmCheckoutSession,
);

// Webhook endpoint moved to app.ts to ensure raw body parsing

export default router;
