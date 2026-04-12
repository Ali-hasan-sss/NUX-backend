import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { validateRequest, walletAdminRateLimiter } from '../../middlewares/security';
import {
  approveWalletWithdrawal,
  getAdminRestaurantWalletBalanceDetail,
  getAdminUserWalletBalanceDetail,
  getAdminWalletOverview,
  getAdminWalletSelectRestaurants,
  getAdminWalletSelectUsers,
  listWalletWithdrawals,
  postAdminManualWalletDebit,
  rejectWalletWithdrawal,
} from '../../controllers/admin/admin.wallet.controller';

const router = Router();

router.use(authenticateUser);
router.use(isAdminMiddleware);
router.use(walletAdminRateLimiter);

router.get('/overview', getAdminWalletOverview);
router.get(
  '/select-options/users',
  query('search').optional().isString().isLength({ max: 120 }),
  query('take').optional().isInt({ min: 1, max: 300 }),
  validateRequest,
  getAdminWalletSelectUsers,
);
router.get(
  '/select-options/restaurants',
  query('search').optional().isString().isLength({ max: 120 }),
  query('take').optional().isInt({ min: 1, max: 300 }),
  validateRequest,
  getAdminWalletSelectRestaurants,
);
router.get('/user/:userId/balance-detail', getAdminUserWalletBalanceDetail);
router.get(
  '/restaurant/:restaurantId/balance-detail',
  getAdminRestaurantWalletBalanceDetail,
);
router.post(
  '/manual-debit',
  body('ownerType').isIn(['USER', 'RESTAURANT']),
  body('ownerId').isUUID(),
  body('amount').isFloat({ gt: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('note').optional().isString().isLength({ max: 2000 }),
  body('idempotencyKey').optional().isString().isLength({ min: 8, max: 200 }),
  validateRequest,
  postAdminManualWalletDebit,
);
router.get('/withdrawals', listWalletWithdrawals);
router.post('/withdrawals/:id/approve', approveWalletWithdrawal);
router.post(
  '/withdrawals/:id/reject',
  body('reason').trim().notEmpty().withMessage('REJECT_REASON_REQUIRED'),
  validateRequest,
  rejectWalletWithdrawal,
);

export default router;
