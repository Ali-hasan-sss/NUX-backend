import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest, walletMutationRateLimiter } from '../../middlewares/security';

import { authenticateUser } from '../../middlewares/Auth';
import {
  updateRestaurantByOwner,
  getRestaurantByOwner,
  regenerateRestaurantQRCodes,
  getFloorPlan,
  updateFloorPlan,
} from '../../controllers/restaurant/restaurant.info.controller';
import {
  getRestaurantWalletBalance,
  getRestaurantWalletLedger,
  getRestaurantWalletLedgerReport,
  getRestaurantWalletLedgerStats,
  createRestaurantWalletTopUpPaymentIntent,
  syncRestaurantWalletTopUpPaymentIntent,
  requestRestaurantWalletWithdrawal,
  listRestaurantWalletWithdrawals,
  cancelRestaurantWalletWithdrawal,
} from '../../controllers/client/wallet.controller';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';

/** Accept full URL (http/https) or server path (/uploads/...) for logo */
const logoValidator = body('logo')
  .optional()
  .isString()
  .custom((value: string) => {
    if (!value || value.trim() === '') return true;
    const v = value.trim();
    if (v.startsWith('http://') || v.startsWith('https://')) {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }
    if (v.startsWith('/uploads/')) return true;
    return false;
  })
  .withMessage('Logo must be a valid URL or /uploads/... path');

const router = express.Router();

// Get own restaurant
router.get(
  '/me',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  getRestaurantByOwner,
);

router.put(
  '/update',
  authenticateUser,
  verifyRestaurantOwnership,
  body('name').optional().isString().withMessage('Name must be a string'),
  logoValidator,
  body('address').optional().isString().withMessage('Address must be a string'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'),

  validateRequest,
  updateRestaurantByOwner,
);

// Regenerate restaurant QR codes
router.put(
  '/qr/regenerate',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  regenerateRestaurantQRCodes,
);

// Floor plan
router.get(
  '/floor-plan',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  getFloorPlan,
);
router.put(
  '/floor-plan',
  authenticateUser,
  verifyRestaurantOwnership,
  body('floorPlan').optional().isObject().withMessage('floorPlan must be an object'),
  validateRequest,
  updateFloorPlan,
);

/** Ledger-based EUR wallet balance for this restaurant (credits from customer wallet payments) */
router.get(
  '/wallet/balance',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  getRestaurantWalletBalance,
);

/** Paged ledger + date filter (dashboard “wallet payments”) — before /wallet/transactions */
router.get(
  '/wallet/transactions/report',
  authenticateUser,
  verifyRestaurantOwnership,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isString().trim(),
  query('endDate').optional().isString().trim(),
  validateRequest,
  getRestaurantWalletLedgerReport,
);

router.get(
  '/wallet/transactions/stats',
  authenticateUser,
  verifyRestaurantOwnership,
  query('startDate').optional().isString().trim(),
  query('endDate').optional().isString().trim(),
  validateRequest,
  getRestaurantWalletLedgerStats,
);

router.get(
  '/wallet/transactions',
  authenticateUser,
  verifyRestaurantOwnership,
  query('take').optional().isInt({ min: 1, max: 100 }),
  query('cursor').optional().isString(),
  validateRequest,
  getRestaurantWalletLedger,
);

router.get(
  '/wallet/withdrawals',
  authenticateUser,
  verifyRestaurantOwnership,
  query('take').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  validateRequest,
  listRestaurantWalletWithdrawals,
);

router.post(
  '/wallet/withdrawals/:id/cancel',
  authenticateUser,
  verifyRestaurantOwnership,
  walletMutationRateLimiter,
  param('id').isUUID(),
  validateRequest,
  cancelRestaurantWalletWithdrawal,
);

router.post(
  '/wallet/top-up/payment-intent',
  authenticateUser,
  verifyRestaurantOwnership,
  walletMutationRateLimiter,
  body('amountEur').isFloat({ min: 1 }).withMessage('amountEur must be >= 1'),
  validateRequest,
  createRestaurantWalletTopUpPaymentIntent,
);

router.post(
  '/wallet/top-up/sync',
  authenticateUser,
  verifyRestaurantOwnership,
  walletMutationRateLimiter,
  body('paymentIntentId').isString().isLength({ min: 10, max: 200 }),
  validateRequest,
  syncRestaurantWalletTopUpPaymentIntent,
);

router.post(
  '/wallet/withdrawals',
  authenticateUser,
  verifyRestaurantOwnership,
  walletMutationRateLimiter,
  body('amount')
    .isFloat({ min: 200 })
    .withMessage('MIN_WITHDRAWAL_200_EUR'),
  body('accountInfo').isObject(),
  validateRequest,
  requestRestaurantWalletWithdrawal,
);

export default router;
