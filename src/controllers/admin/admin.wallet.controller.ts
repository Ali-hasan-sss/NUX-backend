import { Request, Response } from 'express';
import { WalletWithdrawalStatus } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import {
  walletService,
  InsufficientBalanceError,
  WalletValidationError,
} from '../../wallet/services/wallet.service';

/**
 * @swagger
 * /admin/wallet/overview:
 *   get:
 *     summary: User wallet aggregates and reconciliation (admin)
 *     description: >
 *       Per currency: app-user wallet balances and ledger (credits, debits, reconciliation).
 *       User payout totals compare completed user withdrawal rows to WITHDRAWAL debits on USER wallets.
 *       Restaurant payout totals (completed restaurant withdrawal rows vs WITHDRAWAL debits on RESTAURANT wallets)
 *       are included separately; restaurant payouts do not reduce user wallet balances.
 *       Restaurant wallet ledger (balance, credits, debits) is returned per currency so owner top-ups and payouts
 *       are visible separately from user-wallet figures.
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: byCurrency breakdown with reconciliation flags
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 *       500:
 *         description: Server error
 */
export const getAdminWalletOverview = async (req: Request, res: Response) => {
  try {
    const data = await walletService.getAdminUserWalletOverview();
    return successResponse(res, 'User wallet overview', data);
  } catch (e) {
    console.error('getAdminWalletOverview', e);
    return errorResponse(res, 'Server error', 500);
  }
};

function parseWithdrawalListStatus(
  raw: unknown,
): WalletWithdrawalStatus | 'ALL' | null {
  if (raw === undefined || raw === null || raw === '') {
    return 'ALL';
  }
  const s = String(raw).toUpperCase();
  if (s === 'ALL') return 'ALL';
  if (
    s === 'PENDING' ||
    s === 'COMPLETED' ||
    s === 'REJECTED' ||
    s === 'CANCELLED'
  ) {
    return s as WalletWithdrawalStatus;
  }
  return null;
}

/**
 * @swagger
 * /admin/wallet/withdrawals:
 *   get:
 *     summary: List wallet withdrawal requests (paginated, all statuses)
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ALL, PENDING, COMPLETED, REJECTED]
 *           default: ALL
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *     responses:
 *       200:
 *         description: items array and total count for pagination
 *       400:
 *         description: Invalid status filter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 *       500:
 *         description: Server error
 */
export const listWalletWithdrawals = async (req: Request, res: Response) => {
  try {
    const take = Math.min(parseInt(String(req.query.take ?? '50'), 10) || 50, 200);
    const skip = Math.max(parseInt(String(req.query.skip ?? '0'), 10) || 0, 0);
    const statusFilter = parseWithdrawalListStatus(req.query.status);
    if (statusFilter === null) {
      return errorResponse(
        res,
        'Invalid status (use ALL, PENDING, COMPLETED, REJECTED, CANCELLED)',
        400,
      );
    }
    const { total, rows } = await walletService.listWithdrawalsForAdmin({
      status: statusFilter,
      skip,
      take,
    });
    const serialized = rows.map((w) => ({
      id: w.id,
      amount: w.amount.toString(),
      currency: w.currency,
      status: w.status,
      createdAt: w.createdAt,
      reviewedAt: w.reviewedAt,
      accountInfo: w.accountInfo,
      user: w.user,
      restaurant: w.restaurant,
    }));
    return successResponse(res, 'Withdrawals', { items: serialized, total });
  } catch (e) {
    console.error('listWalletWithdrawals', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /admin/wallet/withdrawals/{id}/approve:
 *   post:
 *     summary: Approve withdrawal and debit user wallet ledger
 *     description: Idempotent if ledger line already exists for this withdrawal.
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Approved and debited
 *       400:
 *         description: Invalid state or insufficient user balance at approval time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 *       500:
 *         description: Server error
 */
export const approveWalletWithdrawal = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    if (!id) return errorResponse(res, 'id required', 400);
    await walletService.approveWithdrawal({ withdrawalId: id, adminId });
    return successResponse(res, 'Withdrawal approved and debited');
  } catch (e: unknown) {
    if (e instanceof InsufficientBalanceError) {
      return errorResponse(res, 'User wallet balance no longer covers this withdrawal', 400);
    }
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('approveWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /admin/wallet/withdrawals/{id}/reject:
 *   post:
 *     summary: Reject a pending withdrawal
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rejected
 *       400:
 *         description: Invalid withdrawal id or not pending
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 *       500:
 *         description: Server error
 */
export const rejectWalletWithdrawal = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const reason = req.body?.reason as string | undefined;
    if (!id) return errorResponse(res, 'id required', 400);
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return errorResponse(res, 'REJECT_REASON_REQUIRED', 400);
    }
    await walletService.rejectWithdrawal({
      withdrawalId: id,
      adminId,
      reason: reason.trim(),
    });
    return successResponse(res, 'Withdrawal rejected');
  } catch (e: unknown) {
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('rejectWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};
