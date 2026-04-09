import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import {
  walletService,
  InsufficientBalanceError,
  WalletValidationError,
} from '../../wallet/services/wallet.service';

/**
 * @swagger
 * /admin/wallet/withdrawals:
 *   get:
 *     summary: List pending wallet withdrawal requests
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *     responses:
 *       200:
 *         description: List of withdrawals with nested user summary
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
    const rows = await walletService.listPendingWithdrawals(take);
    return successResponse(res, 'Pending withdrawals', rows);
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
    const args: { withdrawalId: string; adminId: string; reason?: string } = {
      withdrawalId: id,
      adminId,
    };
    if (typeof reason === 'string') args.reason = reason;
    await walletService.rejectWithdrawal(args);
    return successResponse(res, 'Withdrawal rejected');
  } catch (e: unknown) {
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('rejectWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};
