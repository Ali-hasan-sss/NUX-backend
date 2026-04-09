import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { validateRequest, walletAdminRateLimiter } from '../../middlewares/security';
import {
  approveWalletWithdrawal,
  listWalletWithdrawals,
  rejectWalletWithdrawal,
} from '../../controllers/admin/admin.wallet.controller';

const router = Router();

router.use(authenticateUser);
router.use(isAdminMiddleware);
router.use(walletAdminRateLimiter);

router.get('/withdrawals', listWalletWithdrawals);
router.post('/withdrawals/:id/approve', approveWalletWithdrawal);
router.post(
  '/withdrawals/:id/reject',
  body('reason').optional().isString(),
  validateRequest,
  rejectWalletWithdrawal,
);

export default router;
