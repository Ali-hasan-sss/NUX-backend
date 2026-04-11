import { Request, Response } from 'express';
import { PaymentInitiatedFrom, Prisma } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import {
  walletService,
  InsufficientBalanceError,
  WalletValidationError,
} from '../../wallet/services/wallet.service';
import {
  paymentApprovalService,
  PaymentApprovalError,
} from '../../wallet/services/paymentApproval.service';
import { getStripeClient } from '../../lib/stripeClient';
import { getClientIp, getDeviceInfo } from '../../wallet/utils/httpContext';

/**
 * @swagger
 * /client/wallet/balance:
 *   get:
 *     summary: Get current user wallet balance (ledger)
 *     description: Balance is computed from completed credits minus debits. Not stored on User. Also available at GET /wallet/balance.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: balance string and currency code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: string
 *                       description: Decimal amount as string
 *                     currency:
 *                       type: string
 *                       example: EUR
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getWalletBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const data = await walletService.getUserWalletBalance(userId);
    return successResponse(res, 'Wallet balance', data);
  } catch (error) {
    console.error('getWalletBalance', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/wallet/transactions:
 *   get:
 *     summary: Wallet ledger history (paginated)
 *     description: Newest first. Optional cursor is the id of the last entry from the previous page.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Ledger entry id for pagination
 *     responses:
 *       200:
 *         description: Array of ledger entries
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getWalletLedger = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const take = Math.min(parseInt(String(req.query.take ?? '20'), 10) || 20, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const rows = await walletService.listUserLedger(userId, take, cursor);
    return successResponse(res, 'Ledger', rows);
  } catch (error) {
    console.error('getWalletLedger', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/wallet/top-up/payment-intent:
 *   post:
 *     summary: Create Stripe PaymentIntent to top up wallet
 *     description: |
 *       Returns clientSecret for the mobile/web Stripe SDK. Metadata includes userId and wallet_purpose=wallet_topup.
 *       After payment succeeds, the client should POST /client/wallet/top-up/sync with paymentIntentId (credits immediately), or Stripe sends payment_intent.succeeded to the subscription webhook (same idempotent credit).
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amountEur
 *             properties:
 *               amountEur:
 *                 type: number
 *                 minimum: 1
 *                 description: Amount in EUR (charged in cents server-side)
 *     responses:
 *       200:
 *         description: clientSecret and paymentIntentId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                     paymentIntentId:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Stripe or server error
 */
export const createWalletTopUpPaymentIntent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const amountEur = Number(req.body?.amountEur);
    if (!Number.isFinite(amountEur) || amountEur < 1) {
      return errorResponse(res, 'amountEur must be at least 1', 400);
    }

    const stripe = getStripeClient();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amountEur * 100),
      currency: 'eur',
      metadata: {
        userId,
        wallet_purpose: 'wallet_topup',
      },
      automatic_payment_methods: { enabled: true },
    });

    return successResponse(res, 'Payment intent created', {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stripe error';
    console.error('createWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

/**
 * @swagger
 * /client/wallet/top-up/sync:
 *   post:
 *     summary: Sync wallet credit after Stripe payment (no webhook required)
 *     description: |
 *       Retrieves the PaymentIntent from Stripe, verifies status `succeeded` and metadata (`wallet_topup`, same user),
 *       then credits the ledger via the same idempotent path as `payment_intent.succeeded` webhook.
 *       Use when webhooks are delayed or unavailable (e.g. local development).
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *                 example: pi_xxxxxxxxxxxxxxxxxxxxxxxx
 *                 description: Stripe PaymentIntent id from top-up flow
 *     responses:
 *       200:
 *         description: Ledger updated or duplicate (already credited)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     applied:
 *                       type: boolean
 *                     duplicate:
 *                       type: boolean
 *                       description: True if this payment was already credited (idempotent)
 *       400:
 *         description: Invalid paymentIntentId or payment not completed yet
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: PaymentIntent does not belong to this user
 *       500:
 *         description: Stripe or server error
 */
export const syncWalletTopUpPaymentIntent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const paymentIntentId = String(req.body?.paymentIntentId ?? '').trim();
    if (!paymentIntentId.startsWith('pi_')) {
      return errorResponse(res, 'Invalid paymentIntentId', 400);
    }

    const stripe = getStripeClient();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return errorResponse(res, 'Payment is not completed yet', 400);
    }
    if (pi.metadata?.wallet_purpose !== 'wallet_topup' || pi.metadata?.userId !== userId) {
      return errorResponse(res, 'Forbidden', 403);
    }

    const amountReceived = pi.amount_received ?? pi.amount;
    const result = await walletService.applyStripeTopUp({
      paymentIntentId: pi.id,
      amountReceivedCents: amountReceived,
      currency: (pi.currency || 'eur').toUpperCase(),
      userId: pi.metadata.userId,
      metadata: pi.metadata as Record<string, string>,
    });

    return successResponse(res, 'Wallet top-up applied', {
      applied: result.ok,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sync error';
    console.error('syncWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

/**
 * @swagger
 * /client/wallet/pay-restaurant:
 *   post:
 *     summary: Pay a registered restaurant from wallet balance
 *     description: Atomic debit user wallet and credit restaurant wallet. Use idempotencyKey to safely retry the same payment.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - amount
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *                 default: EUR
 *               idempotencyKey:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 200
 *               orderReference:
 *                 type: string
 *                 description: Optional link to an order id or external ref stored in ledger metadata
 *     responses:
 *       200:
 *         description: Payment completed; data.userBalanceAfter is remaining balance string
 *       400:
 *         description: Insufficient balance, inactive restaurant, or validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
/** @deprecated Use POST /client/wallet/pay-restaurant/request + mobile approval. */
export const payRestaurantWithWallet = async (_req: Request, res: Response): Promise<Response> => {
  return errorResponse(
    res,
    'Direct wallet payment is disabled. Use POST /client/wallet/pay-restaurant/request, then approve on the mobile app with your PIN.',
    403,
  );
};

export const getWalletPaymentSecurity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const deviceIdRaw = req.query.deviceId;
    const deviceId =
      typeof deviceIdRaw === 'string' && deviceIdRaw.trim().length > 0 ? deviceIdRaw.trim() : undefined;
    const data = await paymentApprovalService.getSecurityStatus(req.user!.id, deviceId ?? null);
    return successResponse(res, 'Payment security', data);
  } catch (e) {
    console.error('getWalletPaymentSecurity', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const setWalletPaymentPin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { pin, currentPin } = req.body as { pin?: string; currentPin?: string };
    if (!pin || typeof pin !== 'string') {
      return errorResponse(res, 'pin is required', 400);
    }
    await paymentApprovalService.setPaymentPin(req.user!.id, pin, currentPin ?? null);
    return successResponse(res, 'PIN saved', {});
  } catch (e: unknown) {
    if (e instanceof PaymentApprovalError) {
      const status =
        e.code === 'CURRENT_PIN_INVALID' || e.code === 'PIN_INVALID' ? 400 : e.code === 'NOT_FOUND' ? 404 : 400;
      return errorResponse(res, e.message, status);
    }
    console.error('setWalletPaymentPin', e);
    return errorResponse(res, 'Server error', 500);
  }
};

function parseBiometricEnabledFlag(raw: unknown): boolean | null {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return null;
}

export const setWalletPaymentBiometric = async (req: Request, res: Response): Promise<Response> => {
  try {
    const flag = parseBiometricEnabledFlag((req.body as { enabled?: unknown }).enabled);
    if (flag === null) {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    await paymentApprovalService.setBiometricEnabled(req.user!.id, flag);
    return successResponse(res, 'Updated', {});
  } catch (e) {
    console.error('setWalletPaymentBiometric', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const requestWalletPayRestaurant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { restaurantId, amount, currency, orderReference, idempotencyKey, initiatedFrom } = req.body as {
      restaurantId?: string;
      amount?: number;
      currency?: string;
      orderReference?: string;
      idempotencyKey?: string;
      initiatedFrom?: string;
    };

    if (!restaurantId || amount == null) {
      return errorResponse(res, 'restaurantId and amount are required', 400);
    }

    let channel: PaymentInitiatedFrom = PaymentInitiatedFrom.WEB;
    if (initiatedFrom === 'MOBILE' || initiatedFrom === 'mobile') {
      channel = PaymentInitiatedFrom.MOBILE;
    } else if (initiatedFrom === 'WEB' || initiatedFrom === 'web' || initiatedFrom == null) {
      channel = PaymentInitiatedFrom.WEB;
    } else {
      return errorResponse(res, 'initiatedFrom must be web or mobile', 400);
    }

    const headerChannel = String(req.headers['x-client-channel'] ?? '').toLowerCase();
    if (headerChannel === 'mobile') {
      channel = PaymentInitiatedFrom.MOBILE;
    } else if (headerChannel === 'web') {
      channel = PaymentInitiatedFrom.WEB;
    }

    const amt = new Prisma.Decimal(String(amount));
    const data = await paymentApprovalService.createRequest({
      userId,
      restaurantId,
      amount: amt,
      currency: currency ?? 'EUR',
      initiatedFrom: channel,
      orderReference: orderReference ?? null,
      idempotencyKey: idempotencyKey ?? null,
    });

    return successResponse(res, 'Awaiting mobile approval', data);
  } catch (e: unknown) {
    if (e instanceof PaymentApprovalError) {
      return errorResponse(res, e.message, e.code === 'PIN_NOT_SET' ? 428 : 400);
    }
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('requestWalletPayRestaurant', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const approveWalletPayRestaurant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const body = req.body as {
      approvalId?: string;
      approvalToken?: string;
      pin?: string;
      deviceId?: string;
      deviceName?: string;
    };

    const approvalId = body.approvalId?.trim();
    const approvalToken = body.approvalToken?.trim();
    const pin = body.pin?.trim();
    const deviceId = body.deviceId?.trim();
    const deviceName = body.deviceName?.trim();
    console.log('[wallet.approve] incoming', {
      userId,
      hasApprovalId: Boolean(approvalId),
      hasApprovalToken: Boolean(approvalToken),
      hasPin: Boolean(pin && pin.length > 0),
      deviceId,
    });

    if (!approvalId || !approvalToken || !deviceId) {
      return errorResponse(res, 'approvalId, approvalToken, and deviceId are required', 400);
    }

    const result = await paymentApprovalService.approve({
      userId,
      approvalId,
      approvalToken,
      ...(pin && pin.length > 0 ? { pin } : {}),
      deviceId,
      deviceName: deviceName && deviceName.length > 0 ? deviceName : null,
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req),
    });

    return successResponse(res, 'Payment completed', result);
  } catch (e: unknown) {
    if (e instanceof PaymentApprovalError) {
      console.warn('[wallet.approve] PaymentApprovalError', {
        userId: req.user?.id,
        message: e.message,
        code: (e as PaymentApprovalError).code,
      });
      const code = (e as PaymentApprovalError).code;
      const status =
        code === 'EXPIRED'
          ? 410
          : code === 'NOT_FOUND'
            ? 404
            : code === 'TOKEN_INVALID' || code === 'PIN_INVALID'
              ? 401
              : 400;
      return errorResponse(res, e.message, status, code);
    }
    if (e instanceof InsufficientBalanceError) {
      console.warn('[wallet.approve] InsufficientBalanceError', {
        userId: req.user?.id,
        message: e.message,
      });
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }
    if (e instanceof WalletValidationError) {
      console.warn('[wallet.approve] WalletValidationError', {
        userId: req.user?.id,
        message: e.message,
      });
      return errorResponse(res, e.message, 400);
    }
    console.error('approveWalletPayRestaurant', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const rejectWalletPayRestaurant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { approvalId } = req.body as { approvalId?: string };
    if (!approvalId) {
      return errorResponse(res, 'approvalId is required', 400);
    }
    await paymentApprovalService.reject({ userId: req.user!.id, approvalId });
    return successResponse(res, 'Rejected', {});
  } catch (e: unknown) {
    if (e instanceof PaymentApprovalError) {
      return errorResponse(res, e.message, 404);
    }
    console.error('rejectWalletPayRestaurant', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/balance:
 *   get:
 *     summary: Restaurant ledger wallet balance (owner)
 *     description: |
 *       EUR balance from the RESTAURANT wallet ledger (customer wallet payments, Stripe top-ups, approved withdrawals).
 *       Separate from per-restaurant loyalty stars on UserRestaurantBalance.
 *       Requires restaurant ownership middleware (`verifyRestaurantOwnership`).
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: balance and currency
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance: { type: string }
 *                     currency: { type: string, example: EUR }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No restaurant linked to this user
 *       500:
 *         description: Server error
 */
export const getRestaurantWalletBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const data = await walletService.getRestaurantWalletBalance(restaurant.id);
    return successResponse(res, 'Restaurant wallet balance', data);
  } catch (error) {
    console.error('getRestaurantWalletBalance', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/wallet/withdrawals:
 *   post:
 *     summary: Request a wallet withdrawal (pending admin review)
 *     description: Does not debit until an admin approves. accountInfo should include IBAN or payout details as JSON.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - accountInfo
 *             properties:
 *               amount:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               currency:
 *                 type: string
 *                 default: EUR
 *               accountInfo:
 *                 type: object
 *                 additionalProperties: true
 *                 description: e.g. iban, accountHolder, bankName
 *     responses:
 *       200:
 *         description: Request created; data contains id
 *       400:
 *         description: Insufficient balance or validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const requestWalletWithdrawal = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { amount, currency, accountInfo } = req.body as {
      amount?: number;
      currency?: string;
      accountInfo?: Record<string, unknown>;
    };

    if (amount == null || !accountInfo || typeof accountInfo !== 'object') {
      return errorResponse(res, 'amount and accountInfo are required', 400);
    }

    const amt = new Prisma.Decimal(String(amount));
    const out = await walletService.requestWithdrawal({
      userId,
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
    console.error('requestWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/transactions:
 *   get:
 *     summary: Restaurant wallet ledger history (paginated)
 *     description: Newest first. Cursor is the ledger entry id from the previous page.
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Last ledger entry id for pagination
 *     responses:
 *       200:
 *         description: Array of ledger entries
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getRestaurantWalletLedger = async (req: Request, res: Response): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const take = Math.min(parseInt(String(req.query.take ?? '20'), 10) || 20, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const rows = await walletService.listRestaurantLedger(restaurant.id, take, cursor);
    return successResponse(res, 'Restaurant ledger', rows);
  } catch (error) {
    console.error('getRestaurantWalletLedger', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/transactions/report:
 *   get:
 *     summary: Restaurant wallet ledger (paged, date filter, completed only)
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 */
export const getRestaurantWalletLedgerReport = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const startRaw = req.query.startDate ? String(req.query.startDate) : undefined;
    const endRaw = req.query.endDate ? String(req.query.endDate) : undefined;
    const startParsed = startRaw ? new Date(startRaw) : undefined;
    const endParsed = endRaw ? new Date(endRaw) : undefined;
    const startDate =
      startParsed && !Number.isNaN(startParsed.getTime()) ? startParsed : undefined;
    const endDate =
      endParsed && !Number.isNaN(endParsed.getTime()) ? endParsed : undefined;
    const data = await walletService.listRestaurantLedgerPaged({
      restaurantId: restaurant.id,
      page,
      limit,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
    });
    return successResponse(res, 'Restaurant ledger report', data);
  } catch (error) {
    console.error('getRestaurantWalletLedgerReport', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/transactions/stats:
 *   get:
 *     summary: Restaurant wallet ledger statistics (period + rolling counts)
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 */
export const getRestaurantWalletLedgerStats = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const startRaw = req.query.startDate ? String(req.query.startDate) : undefined;
    const endRaw = req.query.endDate ? String(req.query.endDate) : undefined;
    const startParsed = startRaw ? new Date(startRaw) : undefined;
    const endParsed = endRaw ? new Date(endRaw) : undefined;
    const startDate =
      startParsed && !Number.isNaN(startParsed.getTime()) ? startParsed : undefined;
    const endDate =
      endParsed && !Number.isNaN(endParsed.getTime()) ? endParsed : undefined;
    const data = await walletService.getRestaurantLedgerStats({
      restaurantId: restaurant.id,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
    });
    return successResponse(res, 'Restaurant ledger stats', data);
  } catch (error) {
    console.error('getRestaurantWalletLedgerStats', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/top-up/payment-intent:
 *   post:
 *     summary: Create Stripe PaymentIntent to top up restaurant wallet
 *     description: |
 *       Metadata includes `restaurantId`, `ownerUserId`, `wallet_purpose=restaurant_wallet_topup`.
 *       After success, POST `/restaurants/account/wallet/top-up/sync` with `paymentIntentId`, or rely on Stripe webhook.
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amountEur
 *             properties:
 *               amountEur:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: clientSecret and paymentIntentId
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Stripe or server error
 */
export const createRestaurantWalletTopUpPaymentIntent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    const ownerUserId = req.user!.id;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const amountEur = Number(req.body?.amountEur);
    if (!Number.isFinite(amountEur) || amountEur < 1) {
      return errorResponse(res, 'amountEur must be at least 1', 400);
    }

    const stripe = getStripeClient();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amountEur * 100),
      currency: 'eur',
      metadata: {
        restaurantId: restaurant.id,
        ownerUserId,
        wallet_purpose: 'restaurant_wallet_topup',
      },
      automatic_payment_methods: { enabled: true },
    });

    return successResponse(res, 'Payment intent created', {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stripe error';
    console.error('createRestaurantWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

export const syncRestaurantWalletTopUpPaymentIntent = async (req: Request, res: Response) => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
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
      pi.metadata?.wallet_purpose !== 'restaurant_wallet_topup' ||
      pi.metadata?.restaurantId !== restaurant.id
    ) {
      return errorResponse(res, 'Forbidden', 403);
    }

    const amountReceived = pi.amount_received ?? pi.amount;
    const result = await walletService.applyStripeRestaurantTopUp({
      paymentIntentId: pi.id,
      amountReceivedCents: amountReceived,
      currency: (pi.currency || 'eur').toUpperCase(),
      restaurantId: restaurant.id,
      metadata: pi.metadata as Record<string, string>,
    });

    return successResponse(res, 'Restaurant wallet top-up applied', {
      applied: result.ok,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sync error';
    console.error('syncRestaurantWalletTopUpPaymentIntent', error);
    return errorResponse(res, msg, 500);
  }
};

/**
 * @swagger
 * /restaurants/account/wallet/withdrawals:
 *   post:
 *     summary: Request a restaurant wallet withdrawal (pending admin review)
 *     description: Creates a withdrawal row tied to the restaurant ledger; debit on admin approval.
 *     tags: [Restaurant wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - accountInfo
 *             properties:
 *               amount:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               currency:
 *                 type: string
 *                 default: EUR
 *               accountInfo:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Request created; data contains id
 *       400:
 *         description: Insufficient balance or validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const requestRestaurantWalletWithdrawal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    const ownerUserId = req.user!.id;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const { amount, currency, accountInfo } = req.body as {
      amount?: number;
      currency?: string;
      accountInfo?: Record<string, unknown>;
    };

    if (amount == null || !accountInfo || typeof accountInfo !== 'object') {
      return errorResponse(res, 'amount and accountInfo are required', 400);
    }

    const amt = new Prisma.Decimal(String(amount));
    const out = await walletService.requestRestaurantWithdrawal({
      restaurantId: restaurant.id,
      ownerUserId,
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
    console.error('requestRestaurantWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};
