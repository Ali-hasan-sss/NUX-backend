/**
 * Standalone router (optional). In this codebase the same routes are registered on
 * `restaurant.account.routes.ts` under `/restaurants/account` as:
 *   GET /wallet/transactions/report
 *   GET /wallet/transactions/stats
 * Do not mount this file again unless you remove those lines to avoid duplicate routes.
 */
import { Router } from 'express';
import { query } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import {
  getRestaurantWalletLedgerReport,
  getRestaurantWalletLedgerStats,
} from '../../controllers/client/wallet.controller';

const router = Router();

router.get(
  '/transactions/report',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isString().trim(),
  query('endDate').optional().isString().trim(),
  validateRequest,
  getRestaurantWalletLedgerReport,
);

router.get(
  '/transactions/stats',
  query('startDate').optional().isString().trim(),
  query('endDate').optional().isString().trim(),
  validateRequest,
  getRestaurantWalletLedgerStats,
);

export default router;
