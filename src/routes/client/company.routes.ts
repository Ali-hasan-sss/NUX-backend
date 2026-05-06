import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest, walletMutationRateLimiter } from '../../middlewares/security';
import { errorResponse } from '../../utils/response';
import {
  listMyCompanies,
  createCompany,
  getCompany,
  updateCompany,
  patchCompanySubscription,
  addCompanyEmployee,
  removeCompanyEmployee,
  resolveUserByCode,
  runAllowanceDry,
  listCompanyAllowanceTransfers,
  exportCompanyAllowanceTransfersCsv,
} from '../../controllers/company/company.controller';
import {
  getCompanyWalletBalanceHandler,
  getCompanyWalletLedgerHandler,
  createCompanyWalletTopUpPaymentIntent,
  syncCompanyWalletTopUpPaymentIntent,
  requestCompanyWalletWithdrawal,
  listCompanyWalletWithdrawals,
  cancelCompanyWalletWithdrawal,
} from '../../controllers/company/company.wallet.controller';

const router = Router();

function requireCompanyOwner(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const u = (req as import('express').Request & { user?: { role: string } }).user;
  if (!u || u.role !== 'COMPANY_OWNER') {
    return errorResponse(res, 'Company owner access required', 403);
  }
  next();
}

router.use(authenticateUser);
router.use(requireCompanyOwner);

router.get('/', listMyCompanies);

router.post(
  '/',
  body('name').trim().notEmpty().withMessage('name is required'),
  body('taxNumber').trim().notEmpty().withMessage('taxNumber is required'),
  body('commercialRegister').trim().notEmpty().withMessage('commercialRegister is required'),
  body('reportedEmployeeCount').optional().isInt({ min: 0 }),
  body('monthlyAllowancePerEmployee').optional().isString(),
  body('subscriptionPerEmployeeEur').optional().isString(),
  validateRequest,
  createCompany,
);

router.get(
  '/:companyId/wallet/balance',
  param('companyId').isUUID().withMessage('Invalid company id'),
  validateRequest,
  getCompanyWalletBalanceHandler,
);

router.get(
  '/:companyId/wallet/ledger',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('take').optional().isInt({ min: 1, max: 100 }),
  query('cursor').optional().isString(),
  validateRequest,
  getCompanyWalletLedgerHandler,
);

router.post(
  '/:companyId/wallet/top-up/payment-intent',
  walletMutationRateLimiter,
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('amountEur').isFloat({ min: 1 }).withMessage('amountEur must be >= 1'),
  validateRequest,
  createCompanyWalletTopUpPaymentIntent,
);

router.post(
  '/:companyId/wallet/top-up/sync',
  walletMutationRateLimiter,
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('paymentIntentId').isString().isLength({ min: 10, max: 200 }),
  validateRequest,
  syncCompanyWalletTopUpPaymentIntent,
);

router.get(
  '/:companyId/wallet/withdrawals',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('take').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  validateRequest,
  listCompanyWalletWithdrawals,
);

router.post(
  '/:companyId/wallet/withdrawals',
  walletMutationRateLimiter,
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('amount').isFloat({ min: 200 }).withMessage('MIN_WITHDRAWAL_200_EUR'),
  body('accountInfo').isObject(),
  validateRequest,
  requestCompanyWalletWithdrawal,
);

router.post(
  '/:companyId/wallet/withdrawals/:withdrawalId/cancel',
  walletMutationRateLimiter,
  param('companyId').isUUID().withMessage('Invalid company id'),
  param('withdrawalId').isUUID().withMessage('Invalid withdrawal id'),
  validateRequest,
  cancelCompanyWalletWithdrawal,
);

router.get(
  '/:companyId/allowance-transfers',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('take').optional().isInt({ min: 1, max: 500 }),
  query('skip').optional().isInt({ min: 0 }),
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  validateRequest,
  listCompanyAllowanceTransfers,
);

router.get(
  '/:companyId/allowance-transfers/export',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  validateRequest,
  exportCompanyAllowanceTransfersCsv,
);

router.get(
  '/:companyId',
  param('companyId').isUUID().withMessage('Invalid company id'),
  validateRequest,
  getCompany,
);

router.put(
  '/:companyId',
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('name').optional().trim().notEmpty(),
  body('taxNumber').optional().trim().notEmpty(),
  body('commercialRegister').optional().trim().notEmpty(),
  body('reportedEmployeeCount').optional().isInt({ min: 0 }),
  body('monthlyAllowancePerEmployee').optional().isString(),
  body('subscriptionPerEmployeeEur').optional().isString(),
  validateRequest,
  updateCompany,
);

router.patch(
  '/:companyId/subscription',
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('status').isIn(['DRAFT', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).withMessage('Invalid status'),
  validateRequest,
  patchCompanySubscription,
);

router.get(
  '/:companyId/resolve-user',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('code').trim().notEmpty().withMessage('code is required'),
  validateRequest,
  resolveUserByCode,
);

router.post(
  '/:companyId/employees',
  param('companyId').isUUID().withMessage('Invalid company id'),
  body('userId').optional().isUUID(),
  body('userCode').optional().trim().isString(),
  body().custom((_v, { req }) => {
    const b = req.body as { userId?: string; userCode?: string };
    const hasUid = !!(b.userId && String(b.userId).trim());
    const hasCode = !!(b.userCode && String(b.userCode).trim());
    if (!hasUid && !hasCode) {
      throw new Error('Provide userId or userCode (customer app code)');
    }
    return true;
  }),
  validateRequest,
  addCompanyEmployee,
);

router.delete(
  '/:companyId/employees/:userId',
  param('companyId').isUUID().withMessage('Invalid company id'),
  param('userId').isUUID().withMessage('Invalid user id'),
  validateRequest,
  removeCompanyEmployee,
);

router.post(
  '/:companyId/allowance/run',
  param('companyId').isUUID().withMessage('Invalid company id'),
  query('yearMonth').optional().matches(/^\d{4}-\d{2}$/),
  validateRequest,
  runAllowanceDry,
);

export default router;
