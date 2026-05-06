import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import {
  walletService,
  InsufficientBalanceError,
  WalletValidationError,
} from '../../wallet/services/wallet.service';
import { getStripeClient } from '../../lib/stripeClient';
import { getClientIp, getDeviceInfo } from '../../wallet/utils/httpContext';

const prisma = new PrismaClient();

async function assertOwnedCompany(userId: string, companyId: string) {
  const c = await prisma.company.findFirst({
    where: { id: companyId, ownerId: userId },
    select: { id: true },
  });
  return c;
}

/**
 * @swagger
 * tags:
 *   - name: Company wallet
 *     description: Company B2B prefunding wallet (Stripe top-up, withdrawals, ledger)
 */
/**
 * @swagger
 * /client/company/{companyId}/wallet/balance:
 *   get:
 *     summary: Get company wallet balance
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet balance retrieved
 *       404:
 *         description: Company not found
 */
export const getCompanyWalletBalanceHandler = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);
    const data = await walletService.getCompanyWalletBalance(companyId);
    return successResponse(res, 'Company wallet balance', data);
  } catch (e) {
    console.error('getCompanyWalletBalanceHandler', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/ledger:
 *   get:
 *     summary: List company wallet ledger entries
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: take
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ledger entries retrieved
 *       404:
 *         description: Company not found
 */
export const getCompanyWalletLedgerHandler = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);
    const take = Math.min(parseInt(String(req.query.take ?? '20'), 10) || 20, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const rows = await walletService.listCompanyLedger(companyId, take, cursor);
    return successResponse(res, 'Company ledger', rows);
  } catch (e) {
    console.error('getCompanyWalletLedgerHandler', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/top-up/payment-intent:
 *   post:
 *     summary: Create Stripe PaymentIntent for company wallet top-up
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountEur]
 *             properties:
 *               amountEur:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Payment intent created
 *       400:
 *         description: Invalid amount
 *       404:
 *         description: Company not found
 */
export const createCompanyWalletTopUpPaymentIntent = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);

    const amountEur = Number(req.body?.amountEur);
    if (!Number.isFinite(amountEur) || amountEur < 1) {
      return errorResponse(res, 'amountEur must be at least 1', 400);
    }

    const ownerUserId = req.user!.id;
    const stripe = getStripeClient();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amountEur * 100),
      currency: 'eur',
      metadata: {
        companyId,
        ownerUserId,
        wallet_purpose: 'company_wallet_topup',
      },
      automatic_payment_methods: { enabled: true },
    });

    return successResponse(res, 'Payment intent created', {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stripe error';
    console.error('createCompanyWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/top-up/sync:
 *   post:
 *     summary: Confirm Stripe PaymentIntent and apply wallet credit
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentIntentId]
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Top-up applied or already synced
 *       400:
 *         description: Invalid or incomplete payment
 *       403:
 *         description: Payment intent does not belong to this company top-up flow
 *       404:
 *         description: Company not found
 */
export const syncCompanyWalletTopUpPaymentIntent = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);

    const paymentIntentId = String(req.body?.paymentIntentId ?? '').trim();
    if (!paymentIntentId.startsWith('pi_')) {
      return errorResponse(res, 'Invalid paymentIntentId', 400);
    }

    const stripe = getStripeClient();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return errorResponse(res, 'Payment is not completed yet', 400);
    }
    if (
      pi.metadata?.wallet_purpose !== 'company_wallet_topup' ||
      pi.metadata?.companyId !== companyId
    ) {
      return errorResponse(res, 'Forbidden', 403);
    }

    const amountReceived = pi.amount_received ?? pi.amount;
    const result = await walletService.applyStripeCompanyTopUp({
      paymentIntentId: pi.id,
      amountReceivedCents: amountReceived,
      currency: (pi.currency || 'eur').toUpperCase(),
      companyId,
      metadata: pi.metadata as Record<string, string>,
    });

    return successResponse(res, 'Company wallet top-up applied', {
      applied: result.ok,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sync error';
    console.error('syncCompanyWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/withdrawals:
 *   post:
 *     summary: Create a company wallet withdrawal request
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, accountInfo]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Minimum is 200 EUR by route validation
 *               currency:
 *                 type: string
 *                 default: EUR
 *               accountInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Withdrawal request submitted
 *       400:
 *         description: Validation or insufficient balance
 *       404:
 *         description: Company not found
 */
export const requestCompanyWalletWithdrawal = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);

    const { amount, currency, accountInfo } = req.body as {
      amount?: number;
      currency?: string;
      accountInfo?: Record<string, unknown>;
    };

    if (amount == null || !accountInfo || typeof accountInfo !== 'object') {
      return errorResponse(res, 'amount and accountInfo are required', 400);
    }

    const amt = new Prisma.Decimal(String(amount));
    const out = await walletService.requestCompanyWithdrawal({
      companyId,
      ownerUserId: req.user!.id,
      amount: amt,
      currency: currency ?? 'EUR',
      accountInfo: accountInfo as Prisma.InputJsonValue,
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req),
    });

    return successResponse(res, 'Withdrawal request submitted', out);
  } catch (e: unknown) {
    if (e instanceof InsufficientBalanceError) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('requestCompanyWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/withdrawals:
 *   get:
 *     summary: List company withdrawal requests
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: take
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: skip
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Withdrawals retrieved
 *       404:
 *         description: Company not found
 */
export const listCompanyWalletWithdrawals = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);

    const take = Math.min(parseInt(String(req.query.take ?? '50'), 10) || 50, 100);
    const skip = Math.max(parseInt(String(req.query.skip ?? '0'), 10) || 0, 0);
    const { total, rows } = await walletService.listWithdrawalsForCompany({
      companyId,
      skip,
      take,
    });
    return successResponse(res, 'Withdrawals', { items: rows, total });
  } catch (e) {
    console.error('listCompanyWalletWithdrawals', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/wallet/withdrawals/{withdrawalId}/cancel:
 *   post:
 *     summary: Cancel pending company withdrawal request
 *     tags: [Company wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: withdrawalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal cancelled
 *       400:
 *         description: Invalid request or withdrawal cannot be cancelled
 *       404:
 *         description: Company not found
 */
export const cancelCompanyWalletWithdrawal = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const ok = await assertOwnedCompany(req.user!.id, companyId);
    if (!ok) return errorResponse(res, 'Company not found', 404);

    const withdrawalId = String(req.params.withdrawalId ?? '');
    if (!withdrawalId) return errorResponse(res, 'withdrawalId required', 400);

    await walletService.cancelCompanyWithdrawal({
      withdrawalId,
      companyId,
      ownerUserId: req.user!.id,
    });
    return successResponse(res, 'Withdrawal cancelled', {});
  } catch (e: unknown) {
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('cancelCompanyWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};
