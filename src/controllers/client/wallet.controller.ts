import { Request, Response } from 'express';
import { PaymentInitiatedFrom, Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, timingSafeEqual } from 'crypto';
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
import { sendNotificationToUser } from '../../services/notification.service';
import { emitToUser } from '../../services/socket.service';
import { normalizePaymentPinDigits } from '../../wallet/utils/normalizePinDigits';

const prisma = new PrismaClient();
const GIFT_APPROVAL_TTL_MS = 60_000;
const ALLOWED_GIFT_VOUCHER_AMOUNTS = new Set([10, 20, 25, 50]);

type GiftApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
type GiftApprovalRequest = {
  id: string;
  token: string;
  userId: string;
  recipientUserId: string;
  recipientName: string;
  amount: Prisma.Decimal;
  currency: string;
  createdAt: Date;
  expiresAt: Date;
  status: GiftApprovalStatus;
  idempotencyKey?: string | null;
  initiatedFrom: PaymentInitiatedFrom;
};

const giftApprovalStore = new Map<string, GiftApprovalRequest>();
const QR_PAYLOAD_PREFIX = 'LOLITY_USER:';

type GiftRecipientQrPayload = {
  userId?: string;
  id?: string;
  email?: string;
  fullName?: string;
  name?: string;
};

function extractRecipientUserId(recipientCodeRaw: string): string {
  const raw = recipientCodeRaw.trim();
  if (!raw) return '';
  if (raw.startsWith(QR_PAYLOAD_PREFIX)) {
    const jsonPart = raw.slice(QR_PAYLOAD_PREFIX.length);
    try {
      const parsed = JSON.parse(jsonPart) as GiftRecipientQrPayload;
      return String(parsed.userId ?? parsed.id ?? '').trim();
    } catch {
      return '';
    }
  }
  try {
    const parsed = JSON.parse(raw) as GiftRecipientQrPayload;
    return String(parsed.userId ?? parsed.id ?? '').trim();
  } catch {
    return raw;
  }
}

function generateGiftApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

function safeEqualGiftToken(stored: string, given: string): boolean {
  const a = Buffer.from(stored, 'utf8');
  const b = Buffer.from(given, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cleanupExpiredGiftApprovals(now = new Date()): void {
  for (const [id, req] of giftApprovalStore.entries()) {
    if (req.status === 'PENDING' && req.expiresAt <= now) {
      giftApprovalStore.set(id, { ...req, status: 'EXPIRED' });
    }
  }
}

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
 * /client/wallet/gift-voucher:
 *   post:
 *     summary: Gift fixed-value EUR voucher to another user
 *     description: |
 *       Transfers money from the authenticated user's wallet to another USER wallet only.
 *       Recipient is identified by `recipientCode` (recipient user id from scanned code).
 *       Allowed amounts are fixed to 10, 20, 25, or 50 EUR.
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
 *               - recipientCode
 *               - amount
 *             properties:
 *               recipientCode:
 *                 type: string
 *                 description: Recipient identifier from scanned code (supports raw user id or rich QR payload)
 *               amount:
 *                 type: number
 *                 enum: [10, 20, 25, 50]
 *                 description: Fixed voucher amount in EUR
 *               idempotencyKey:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 200
 *                 description: Optional key to safely retry the same gift request
 *     responses:
 *       200:
 *         description: Voucher gifted successfully
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
 *                     senderBalanceAfter:
 *                       type: string
 *                       description: Sender remaining wallet balance after gift
 *       400:
 *         description: Invalid amount, insufficient balance, self-gift, or invalid recipient
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recipient not found
 *       500:
 *         description: Server error
 */
export const giftWalletVoucher = async (req: Request, res: Response): Promise<Response> => {
  try {
    const senderUserId = req.user!.id;
    const { recipientCode, amount, idempotencyKey, initiatedFrom } = req.body as {
      recipientCode?: string;
      amount?: number;
      idempotencyKey?: string;
      initiatedFrom?: string;
    };

    if (!recipientCode || amount == null) {
      return errorResponse(res, 'recipientCode and amount are required', 400);
    }
    if (!ALLOWED_GIFT_VOUCHER_AMOUNTS.has(Number(amount))) {
      return errorResponse(res, 'amount must be one of 10, 20, 25, 50', 400);
    }

    const recipientIdFromCode = extractRecipientUserId(recipientCode);
    const recipientLookupCode = recipientIdFromCode || recipientCode;

    const recipient = await prisma.user.findFirst({
      where: {
        OR: [{ id: recipientLookupCode }, { qrCode: recipientLookupCode }],
      },
      select: { id: true, fullName: true, role: true },
    });
    if (!recipient) {
      return errorResponse(res, 'Recipient not found', 404);
    }
    if (recipient.role !== 'USER') {
      return errorResponse(res, 'Recipient must be a user account', 400);
    }
    if (recipient.id === senderUserId) {
      return errorResponse(res, 'Cannot gift voucher to yourself', 400);
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderUserId },
      select: { pinHash: true },
    });
    if (!sender?.pinHash) {
      return errorResponse(
        res,
        'Set a payment PIN in the mobile app before gifting vouchers from web.',
        428,
      );
    }

    cleanupExpiredGiftApprovals();
    const now = new Date();
    let channel: PaymentInitiatedFrom = PaymentInitiatedFrom.WEB;
    if (initiatedFrom === 'MOBILE' || initiatedFrom === 'mobile') {
      channel = PaymentInitiatedFrom.MOBILE;
    }
    const headerChannel = String(req.headers['x-client-channel'] ?? '').toLowerCase();
    if (headerChannel === 'mobile') channel = PaymentInitiatedFrom.MOBILE;
    if (headerChannel === 'web') channel = PaymentInitiatedFrom.WEB;

    if (idempotencyKey && idempotencyKey.trim().length > 0) {
      const existing = Array.from(giftApprovalStore.values()).find(
        (x) =>
          x.userId === senderUserId &&
          x.idempotencyKey === idempotencyKey &&
          x.status === 'PENDING' &&
          x.expiresAt > now,
      );
      if (existing) {
        emitToUser(senderUserId, 'NEW_GIFT_VOUCHER_REQUEST', {
          approvalId: existing.id,
          approvalToken: existing.token,
          recipientUserId: existing.recipientUserId,
          recipientName: existing.recipientName,
          amount: existing.amount.toString(),
          currency: existing.currency,
          expiresAt: existing.expiresAt.toISOString(),
          initiatedFrom: existing.initiatedFrom,
        });
        return successResponse(res, 'Awaiting mobile approval', {
          approvalId: existing.id,
          approvalToken: existing.token,
          recipientUserId: existing.recipientUserId,
          recipientName: existing.recipientName,
          amount: existing.amount.toString(),
          currency: existing.currency,
          expiresAt: existing.expiresAt.toISOString(),
          initiatedFrom: existing.initiatedFrom,
        });
      }
    }

    const approvalId = randomBytes(16).toString('hex');
    const approvalToken = generateGiftApprovalToken();
    const expiresAt = new Date(now.getTime() + GIFT_APPROVAL_TTL_MS);
    const approval: GiftApprovalRequest = {
      id: approvalId,
      token: approvalToken,
      userId: senderUserId,
      recipientUserId: recipient.id,
      recipientName: recipient.fullName || 'recipient',
      amount: new Prisma.Decimal(String(amount)),
      currency: 'EUR',
      createdAt: now,
      expiresAt,
      status: 'PENDING',
      idempotencyKey: idempotencyKey ?? null,
      initiatedFrom: channel,
    };
    giftApprovalStore.set(approvalId, approval);

    emitToUser(senderUserId, 'NEW_GIFT_VOUCHER_REQUEST', {
      approvalId,
      approvalToken,
      recipientUserId: approval.recipientUserId,
      recipientName: approval.recipientName,
      amount: approval.amount.toString(),
      currency: approval.currency,
      expiresAt: approval.expiresAt.toISOString(),
      initiatedFrom: approval.initiatedFrom,
    });

    return successResponse(res, 'Awaiting mobile approval', {
      approvalId,
      approvalToken,
      recipientUserId: approval.recipientUserId,
      recipientName: approval.recipientName,
      amount: approval.amount.toString(),
      currency: approval.currency,
      expiresAt: approval.expiresAt.toISOString(),
      initiatedFrom: approval.initiatedFrom,
    });
  } catch (e: unknown) {
    if (e instanceof InsufficientBalanceError) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('giftWalletVoucher', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/wallet/gift-voucher/approve:
 *   post:
 *     summary: Approve pending wallet voucher gift from trusted mobile device
 *     description: |
 *       Finalizes a pending gift request created by POST /client/wallet/gift-voucher.
 *       Requires approvalToken + trusted device context. PIN is required unless biometric is enabled and device is already trusted.
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
 *               - approvalId
 *               - approvalToken
 *               - deviceId
 *             properties:
 *               approvalId:
 *                 type: string
 *               approvalToken:
 *                 type: string
 *               pin:
 *                 type: string
 *                 description: Optional when biometric-enabled trusted device is used
 *               deviceId:
 *                 type: string
 *               deviceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gift approved and transferred
 *       400:
 *         description: Invalid request, expired request, or PIN/trust validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Pending approval not found
 *       500:
 *         description: Server error
 */
export const approveGiftWalletVoucher = async (req: Request, res: Response): Promise<Response> => {
  try {
    cleanupExpiredGiftApprovals();
    const userId = req.user!.id;
    const senderName = req.user?.fullName || 'User';
    const {
      approvalId,
      approvalToken,
      pin,
      deviceId,
      deviceName,
    } = req.body as {
      approvalId?: string;
      approvalToken?: string;
      pin?: string;
      deviceId?: string;
      deviceName?: string;
    };

    if (!approvalId || !approvalToken || !deviceId || String(deviceId).trim().length < 8) {
      return errorResponse(res, 'approvalId, approvalToken, and valid deviceId are required', 400);
    }

    const row = giftApprovalStore.get(approvalId);
    if (!row || row.userId !== userId) {
      return errorResponse(res, 'Gift approval not found', 404);
    }
    if (row.status === 'APPROVED') {
      const bal = await walletService.getUserWalletBalance(userId);
      return successResponse(res, 'Gift already approved', { senderBalanceAfter: bal.balance });
    }
    if (row.status !== 'PENDING') {
      return errorResponse(res, 'Approval is no longer pending', 400);
    }
    if (row.expiresAt <= new Date()) {
      giftApprovalStore.set(approvalId, { ...row, status: 'EXPIRED' });
      emitToUser(userId, 'GIFT_VOUCHER_REQUEST_RESOLVED', { approvalId, status: 'expired' });
      return errorResponse(res, 'Approval expired', 400);
    }
    if (!safeEqualGiftToken(row.token, String(approvalToken).trim())) {
      return errorResponse(res, 'Invalid approval token', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true, biometricEnabled: true },
    });
    if (!user?.pinHash) {
      return errorResponse(res, 'Payment PIN not set', 400);
    }

    const normalizedDeviceId = String(deviceId).trim();
    const trustedDevice = await prisma.userDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId: normalizedDeviceId } },
      select: { isTrusted: true },
    });
    const isTrustedDevice = Boolean(trustedDevice?.isTrusted);

    const providedPin = pin?.trim();
    if (providedPin && providedPin.length > 0) {
      const pinNorm = normalizePaymentPinDigits(providedPin);
      const pinOk = await bcrypt.compare(pinNorm, user.pinHash);
      if (!pinOk) {
        return errorResponse(res, 'Invalid PIN', 400);
      }
    } else {
      if (!user.biometricEnabled) {
        return errorResponse(res, 'PIN required', 400);
      }
      if (!isTrustedDevice) {
        return errorResponse(res, 'First approval on this device requires payment PIN', 400);
      }
    }

    await prisma.userDevice.upsert({
      where: { userId_deviceId: { userId, deviceId: normalizedDeviceId } },
      create: {
        userId,
        deviceId: normalizedDeviceId,
        deviceName: deviceName ?? null,
        lastSeen: new Date(),
      },
      update: {
        lastSeen: new Date(),
        ...(deviceName != null && deviceName !== '' ? { deviceName } : {}),
      },
    });

    const transfer = await walletService.giftVoucherToUser({
      senderUserId: userId,
      recipientUserId: row.recipientUserId,
      amount: row.amount,
      currency: row.currency,
      idempotencyKey: `gift_approval_${row.id}`,
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req),
    });

    if (providedPin && providedPin.length > 0) {
      await prisma.userDevice.updateMany({
        where: { userId, deviceId: normalizedDeviceId },
        data: { isTrusted: true },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { trustedDeviceId: normalizedDeviceId },
      });
    }

    giftApprovalStore.set(approvalId, { ...row, status: 'APPROVED' });
    emitToUser(userId, 'GIFT_VOUCHER_REQUEST_RESOLVED', {
      approvalId,
      status: 'approved',
      senderBalanceAfter: transfer.senderBalanceAfter,
    });

    const notificationResults = await Promise.allSettled([
      sendNotificationToUser({
        userId,
        title: 'Voucher Sent',
        body: `You sent ${row.amount.toString()} EUR to ${row.recipientName}`,
        type: 'PAYMENT',
      }),
      sendNotificationToUser({
        userId: row.recipientUserId,
        title: 'Voucher Received',
        body: `You received ${row.amount.toString()} EUR from ${senderName}`,
        type: 'PAYMENT',
      }),
    ]);

    if (notificationResults[0]?.status === 'rejected') {
      try {
        await sendNotificationToUser({
          userId,
          title: 'Voucher Sent',
          body: `You sent ${row.amount.toString()} EUR to ${row.recipientName}`,
          type: 'PAYMENT',
        });
      } catch (retryErr) {
        console.error('approveGiftWalletVoucher sender notification retry failed', retryErr);
      }
    }

    return successResponse(res, 'Voucher gifted successfully', transfer);
  } catch (e: unknown) {
    if (e instanceof InsufficientBalanceError) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('approveGiftWalletVoucher', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const rejectGiftWalletVoucher = async (req: Request, res: Response): Promise<Response> => {
  try {
    cleanupExpiredGiftApprovals();
    const userId = req.user!.id;
    const { approvalId } = req.body as { approvalId?: string };
    if (!approvalId) {
      return errorResponse(res, 'approvalId is required', 400);
    }
    const row = giftApprovalStore.get(approvalId);
    if (!row || row.userId !== userId) {
      return errorResponse(res, 'Gift approval not found', 404);
    }
    if (row.status === 'PENDING') {
      giftApprovalStore.set(approvalId, { ...row, status: 'REJECTED' });
      emitToUser(userId, 'GIFT_VOUCHER_REQUEST_RESOLVED', {
        approvalId,
        status: 'rejected',
      });
    }
    return successResponse(res, 'Rejected', {});
  } catch (e: unknown) {
    console.error('rejectGiftWalletVoucher', e);
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

export const listUserWalletWithdrawals = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const take = Math.min(parseInt(String(req.query.take ?? '50'), 10) || 50, 100);
    const skip = Math.max(parseInt(String(req.query.skip ?? '0'), 10) || 0, 0);
    const { total, rows } = await walletService.listWithdrawalsForUser({ userId, skip, take });
    return successResponse(res, 'Withdrawals', { items: rows, total });
  } catch (e) {
    console.error('listUserWalletWithdrawals', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const cancelUserWalletWithdrawal = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return errorResponse(res, 'id required', 400);
    await walletService.cancelUserWithdrawal({ withdrawalId: id, userId });
    return successResponse(res, 'Withdrawal cancelled', {});
  } catch (e: unknown) {
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('cancelUserWalletWithdrawal', e);
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

export const listRestaurantWalletWithdrawals = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const take = Math.min(parseInt(String(req.query.take ?? '50'), 10) || 50, 100);
    const skip = Math.max(parseInt(String(req.query.skip ?? '0'), 10) || 0, 0);
    const { total, rows } = await walletService.listWithdrawalsForRestaurant({
      restaurantId: restaurant.id,
      skip,
      take,
    });
    return successResponse(res, 'Withdrawals', { items: rows, total });
  } catch (e) {
    console.error('listRestaurantWalletWithdrawals', e);
    return errorResponse(res, 'Server error', 500);
  }
};

export const cancelRestaurantWalletWithdrawal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const restaurant = (req as unknown as { restaurant?: { id: string } }).restaurant;
    const ownerUserId = req.user!.id;
    if (!restaurant?.id) {
      return errorResponse(res, 'Restaurant context missing', 500);
    }
    const { id } = req.params;
    if (!id) return errorResponse(res, 'id required', 400);
    await walletService.cancelRestaurantWithdrawal({
      withdrawalId: id,
      restaurantId: restaurant.id,
      ownerUserId,
    });
    return successResponse(res, 'Withdrawal cancelled', {});
  } catch (e: unknown) {
    if (e instanceof WalletValidationError) {
      return errorResponse(res, e.message, 400);
    }
    console.error('cancelRestaurantWalletWithdrawal', e);
    return errorResponse(res, 'Server error', 500);
  }
};
