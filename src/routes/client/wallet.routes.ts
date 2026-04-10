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
  getWalletPaymentSecurity,
  setWalletPaymentPin,
  setWalletPaymentBiometric,
  requestWalletPayRestaurant,
  approveWalletPayRestaurant,
  rejectWalletPayRestaurant,
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

router.get(
  '/payment-security',
  query('deviceId').optional().isString().isLength({ min: 8, max: 200 }),
  validateRequest,
  getWalletPaymentSecurity,
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

const paymentPinValidators = [
  body('pin').isString().isLength({ min: 6, max: 12 }),
  body('currentPin').optional().isString(),
  validateRequest,
  setWalletPaymentPin,
];
router.put('/payment-pin', ...paymentPinValidators);
/** POST alias: same as PUT (some clients/proxies mishandle PUT). */
router.post('/payment-pin', ...paymentPinValidators);

/** Body.enabled parsed loosely in controller (RN / proxies may send 0/1 or strings). */
router.patch('/payment-biometric', setWalletPaymentBiometric);
/** POST alias: PATCH is often blocked by proxies (client sees 404). */
router.post('/payment-biometric', setWalletPaymentBiometric);

router.post(
  '/pay-restaurant/request',
  body('restaurantId').isUUID(),
  body('amount').isFloat({ gt: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('idempotencyKey').optional().isString().isLength({ min: 8, max: 200 }),
  body('orderReference').optional().isString(),
  body('initiatedFrom').optional().isIn(['web', 'WEB', 'mobile', 'MOBILE']),
  validateRequest,
  requestWalletPayRestaurant,
);

router.post(
  '/pay-restaurant/approve',
  body('approvalId').isUUID(),
  body('approvalToken').isString().isLength({ min: 32, max: 200 }),
  /** PIN optional when client approved with biometric only; server enforces rules in paymentApprovalService. */
  body('pin')
    .optional({ checkFalsy: true, nullable: true })
    .isString()
    .trim()
    .isLength({ min: 6, max: 12 }),
  body('deviceId').isString().isLength({ min: 8, max: 200 }),
  body('deviceName').optional().isString().isLength({ max: 120 }),
  validateRequest,
  approveWalletPayRestaurant,
);

router.post(
  '/pay-restaurant/reject',
  body('approvalId').isUUID(),
  validateRequest,
  rejectWalletPayRestaurant,
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
