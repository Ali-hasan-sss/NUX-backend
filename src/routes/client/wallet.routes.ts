import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest, walletMutationRateLimiter } from '../../middlewares/security';
import {
  createWalletTopUpPaymentIntent,
  syncWalletTopUpPaymentIntent,
  getWalletBalance,
  getWalletLedger,
  payRestaurantWithWallet,
  requestWalletWithdrawal,
} from '../../controllers/client/wallet.controller';

const router = Router();

router.use(authenticateUser);

router.get('/balance', getWalletBalance);

router.get(
  '/transactions',
  query('take').optional().isInt({ min: 1, max: 100 }),
  query('cursor').optional().isString(),
  validateRequest,
  getWalletLedger,
);

router.use(walletMutationRateLimiter);

router.post(
  '/top-up/payment-intent',
  body('amountEur').isFloat({ min: 1 }).withMessage('amountEur must be >= 1'),
  validateRequest,
  createWalletTopUpPaymentIntent,
);

router.post(
  '/top-up/sync',
  body('paymentIntentId').isString().isLength({ min: 10, max: 200 }),
  validateRequest,
  syncWalletTopUpPaymentIntent,
);

router.post(
  '/pay-restaurant',
  body('restaurantId').isUUID(),
  body('amount').isFloat({ gt: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('idempotencyKey').optional().isString().isLength({ min: 8, max: 200 }),
  body('orderReference').optional().isString(),
  validateRequest,
  payRestaurantWithWallet,
);

router.post(
  '/withdrawals',
  body('amount').isFloat({ gt: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('accountInfo').isObject(),
  validateRequest,
  requestWalletWithdrawal,
);

export default router;
