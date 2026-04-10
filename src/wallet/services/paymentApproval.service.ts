import { Prisma, PrismaClient, PaymentInitiatedFrom } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { walletService, InsufficientBalanceError, WalletValidationError } from './wallet.service';
import { emitToUser } from '../../services/socket.service';
import { AuditService } from './audit.service';
import { normalizePaymentPinDigits } from '../utils/normalizePinDigits';
import { sendNotificationToUser } from '../../services/notification.service';

const APPROVAL_TTL_MS = 60_000;
const BCRYPT_ROUNDS = 10;

export class PaymentApprovalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'PaymentApprovalError';
  }
}

function generateApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

function safeEqualToken(stored: string, given: string): boolean {
  const a = Buffer.from(stored, 'utf8');
  const b = Buffer.from(given, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class PaymentApprovalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async getSecurityStatus(
    userId: string,
    deviceId?: string | null,
  ): Promise<{
    hasPin: boolean;
    biometricEnabled: boolean;
    trustedDeviceId: string | null;
    /** True when this client device has completed at least one PIN approval (server-trusted). */
    currentDeviceTrusted: boolean;
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true, biometricEnabled: true, trustedDeviceId: true },
    });
    const trimmed = deviceId?.trim();
    let currentDeviceTrusted = false;
    if (trimmed && trimmed.length >= 8) {
      const row = await this.prisma.userDevice.findUnique({
        where: { userId_deviceId: { userId, deviceId: trimmed } },
        select: { isTrusted: true },
      });
      currentDeviceTrusted = Boolean(row?.isTrusted);
    }
    return {
      hasPin: Boolean(u?.pinHash),
      biometricEnabled: u?.biometricEnabled ?? false,
      trustedDeviceId: u?.trustedDeviceId ?? null,
      currentDeviceTrusted,
    };
  }

  async setPaymentPin(userId: string, pin: string, currentPin?: string | null): Promise<void> {
    const pinNorm = normalizePaymentPinDigits(pin);
    const currentNorm =
      currentPin != null && String(currentPin).length > 0
        ? normalizePaymentPinDigits(String(currentPin))
        : null;
    if (pinNorm.length < 6 || pinNorm.length > 12 || !/^\d+$/.test(pinNorm)) {
      throw new PaymentApprovalError('PIN must be 6–12 digits', 'PIN_INVALID');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true },
    });
    if (!user) {
      throw new PaymentApprovalError('User not found', 'NOT_FOUND');
    }
    if (user.pinHash) {
      if (!currentNorm) {
        throw new PaymentApprovalError('Current PIN required', 'CURRENT_PIN_REQUIRED');
      }
      const ok = await bcrypt.compare(currentNorm, user.pinHash);
      if (!ok) {
        throw new PaymentApprovalError('Invalid current PIN', 'CURRENT_PIN_INVALID');
      }
    }
    const pinHash = await bcrypt.hash(pinNorm, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });
    await this.audit.log({
      userId,
      action: 'WALLET_PAYMENT_PIN_SET',
      metadata: { changed: Boolean(user.pinHash) } as Prisma.InputJsonValue,
    });
  }

  async setBiometricEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { biometricEnabled: enabled },
    });
  }

  async createRequest(params: {
    userId: string;
    restaurantId: string;
    amount: Prisma.Decimal;
    currency?: string;
    initiatedFrom: PaymentInitiatedFrom;
    orderReference?: string | null;
    idempotencyKey?: string | null;
  }): Promise<{
    approvalId: string;
    approvalToken: string;
    expiresAt: string;
    restaurantName: string;
    amount: string;
    currency: string;
    initiatedFrom: PaymentInitiatedFrom;
  }> {
    if (params.amount.lte(0)) {
      throw new WalletValidationError('Amount must be positive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { pinHash: true },
    });
    if (!user?.pinHash) {
      throw new PaymentApprovalError(
        'Set a payment PIN in the mobile app before paying from the web.',
        'PIN_NOT_SET',
      );
    }

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: params.restaurantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!restaurant) {
      throw new WalletValidationError('Restaurant not found or inactive');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS);
    const curr = params.currency ?? 'EUR';

    if (params.idempotencyKey) {
      const existing = await this.prisma.paymentApproval.findFirst({
        where: {
          userId: params.userId,
          idempotencyKey: params.idempotencyKey,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
      });
      if (existing) {
        const rName =
          existing.restaurantId === params.restaurantId
            ? restaurant.name
            : (
                await this.prisma.restaurant.findUnique({
                  where: { id: existing.restaurantId },
                  select: { name: true },
                })
              )?.name ?? '';
        emitToUser(params.userId, 'NEW_PAYMENT_REQUEST', {
          approvalId: existing.id,
          approvalToken: existing.approvalToken,
          restaurantId: existing.restaurantId,
          restaurantName: rName,
          amount: existing.amount.toString(),
          currency: existing.currency,
          expiresAt: existing.expiresAt.toISOString(),
          initiatedFrom: existing.initiatedFrom,
        });
        return {
          approvalId: existing.id,
          approvalToken: existing.approvalToken,
          expiresAt: existing.expiresAt.toISOString(),
          restaurantName: rName,
          amount: existing.amount.toString(),
          currency: existing.currency,
          initiatedFrom: existing.initiatedFrom,
        };
      }
    }

    const approvalToken = generateApprovalToken();

    const row = await this.prisma.paymentApproval.create({
      data: {
        userId: params.userId,
        restaurantId: params.restaurantId,
        amount: params.amount,
        currency: curr,
        status: 'PENDING',
        approvalToken,
        initiatedFrom: params.initiatedFrom,
        orderReference: params.orderReference ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
        expiresAt,
      },
    });

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_PAYMENT_APPROVAL_CREATED',
      metadata: {
        approvalId: row.id,
        restaurantId: params.restaurantId,
        amount: params.amount.toString(),
        initiatedFrom: params.initiatedFrom,
      } as Prisma.InputJsonValue,
    });

    emitToUser(params.userId, 'NEW_PAYMENT_REQUEST', {
      approvalId: row.id,
      approvalToken,
      restaurantId: row.restaurantId,
      restaurantName: restaurant.name,
      amount: row.amount.toString(),
      currency: row.currency,
      expiresAt: row.expiresAt.toISOString(),
      initiatedFrom: row.initiatedFrom,
    });

    return {
      approvalId: row.id,
      approvalToken,
      expiresAt: row.expiresAt.toISOString(),
      restaurantName: restaurant.name,
      amount: row.amount.toString(),
      currency: row.currency,
      initiatedFrom: row.initiatedFrom,
    };
  }

  async reject(params: { userId: string; approvalId: string }): Promise<void> {
    const row = await this.prisma.paymentApproval.findFirst({
      where: { id: params.approvalId, userId: params.userId },
    });
    if (!row) {
      throw new PaymentApprovalError('Approval not found', 'NOT_FOUND');
    }
    if (row.status !== 'PENDING') {
      return;
    }
    await this.prisma.paymentApproval.updateMany({
      where: { id: params.approvalId, userId: params.userId, status: 'PENDING' },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });
    emitToUser(params.userId, 'PAYMENT_REQUEST_RESOLVED', {
      approvalId: params.approvalId,
      status: 'rejected',
    });
  }

  async approve(params: {
    userId: string;
    approvalId: string;
    approvalToken: string;
    pin?: string;
    deviceId: string;
    deviceName?: string | null;
    ipAddress?: string | null;
    deviceInfo?: string | null;
  }): Promise<{ userBalanceAfter: string }> {
    console.log('[paymentApproval.approve] start', {
      userId: params.userId,
      approvalId: params.approvalId,
      hasPin: Boolean(params.pin && params.pin.trim().length > 0),
      deviceId: params.deviceId,
    });
    if (!params.deviceId || params.deviceId.length < 8) {
      console.warn('[paymentApproval.approve] invalid_device', { deviceId: params.deviceId });
      throw new PaymentApprovalError('Valid deviceId is required', 'DEVICE_REQUIRED');
    }

    const now = new Date();
    const approvalId = params.approvalId.trim();
    const approval = await this.prisma.paymentApproval.findFirst({
      where: { id: approvalId, userId: params.userId },
    });

    if (!approval) {
      console.warn('[paymentApproval.approve] approval_not_found', {
        approvalId,
        userId: params.userId,
      });
      throw new PaymentApprovalError(
        'Payment request not found. It may have expired, been cancelled, or was created while signed in as another user. Use the same account on web and app, or start a new payment from the website.',
        'NOT_FOUND',
      );
    }

    if (approval.expiresAt <= now && approval.status === 'PENDING') {
      console.warn('[paymentApproval.approve] approval_expired', { approvalId: approval.id });
      await this.prisma.paymentApproval.updateMany({
        where: { id: approval.id, status: 'PENDING' },
        data: { status: 'EXPIRED', resolvedAt: now },
      });
      emitToUser(params.userId, 'PAYMENT_REQUEST_RESOLVED', {
        approvalId: approval.id,
        status: 'expired',
      });
      throw new PaymentApprovalError('Approval expired', 'EXPIRED');
    }

    if (approval.status === 'APPROVED') {
      console.log('[paymentApproval.approve] already_approved', { approvalId: approval.id });
      const bal = await walletService.getUserWalletBalance(params.userId);
      return { userBalanceAfter: bal.balance };
    }

    if (approval.status !== 'PENDING') {
      console.warn('[paymentApproval.approve] invalid_status', {
        approvalId: approval.id,
        status: approval.status,
      });
      throw new PaymentApprovalError('Approval is no longer pending', 'INVALID_STATUS');
    }

    const tokenGiven = params.approvalToken.trim();
    if (!safeEqualToken(approval.approvalToken, tokenGiven)) {
      console.warn('[paymentApproval.approve] invalid_token', { approvalId: approval.id });
      throw new PaymentApprovalError('Invalid approval token', 'TOKEN_INVALID');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { pinHash: true, trustedDeviceId: true, biometricEnabled: true },
    });
    if (!user?.pinHash) {
      console.warn('[paymentApproval.approve] pin_not_set', { userId: params.userId });
      throw new PaymentApprovalError('Payment PIN not set', 'PIN_NOT_SET');
    }

    const providedPin = params.pin?.trim();
    const trustedDevice = await this.prisma.userDevice.findUnique({
      where: {
        userId_deviceId: { userId: params.userId, deviceId: params.deviceId },
      },
      select: { isTrusted: true },
    });
    const isTrustedDevice = Boolean(trustedDevice?.isTrusted);

    if (providedPin && providedPin.length > 0) {
      const pinNorm = normalizePaymentPinDigits(providedPin);
      const pinOk = await bcrypt.compare(pinNorm, user.pinHash);
      if (!pinOk) {
        console.warn('[paymentApproval.approve] invalid_pin', { userId: params.userId });
        throw new PaymentApprovalError('Invalid PIN', 'PIN_INVALID');
      }
    } else {
      // Biometric-only path: allowed only for trusted devices.
      if (!user.biometricEnabled) {
        console.warn('[paymentApproval.approve] biometric_not_enabled', { userId: params.userId });
        throw new PaymentApprovalError('PIN required', 'PIN_REQUIRED');
      }
      if (!isTrustedDevice) {
        console.warn('[paymentApproval.approve] trusted_device_required', {
          userId: params.userId,
          deviceId: params.deviceId,
        });
        throw new PaymentApprovalError(
          'First approval on this device requires payment PIN',
          'TRUSTED_DEVICE_REQUIRED',
        );
      }
    }

    await this.prisma.userDevice.upsert({
      where: {
        userId_deviceId: { userId: params.userId, deviceId: params.deviceId },
      },
      create: {
        userId: params.userId,
        deviceId: params.deviceId,
        deviceName: params.deviceName ?? null,
        lastSeen: now,
      },
      update: {
        lastSeen: now,
        ...(params.deviceName != null && params.deviceName !== ''
          ? { deviceName: params.deviceName }
          : {}),
      },
    });

    const idem = `wallet_pay_approval_${approval.id}`;

    let payResult: { userBalanceAfter: string };
    try {
      payResult = await walletService.payRestaurant({
        userId: params.userId,
        restaurantId: approval.restaurantId,
        amount: approval.amount,
        currency: approval.currency,
        idempotencyKey: idem,
        orderReference: approval.orderReference ?? null,
        ipAddress: params.ipAddress ?? null,
        deviceInfo: params.deviceInfo ?? null,
      });
    } catch (e: unknown) {
      console.error('[paymentApproval.approve] pay_restaurant_failed', e);
      if (e instanceof InsufficientBalanceError || e instanceof WalletValidationError) {
        throw e;
      }
      throw e;
    }

    const updated = await this.prisma.paymentApproval.updateMany({
      where: { id: approval.id, userId: params.userId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        deviceId: params.deviceId,
        resolvedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const bal = await walletService.getUserWalletBalance(params.userId);
      return { userBalanceAfter: bal.balance };
    }

    // Server-managed trust: once PIN is verified on a device at least once, mark it trusted.
    if (providedPin && providedPin.length > 0) {
      await this.prisma.userDevice.updateMany({
        where: { userId: params.userId, deviceId: params.deviceId },
        data: { isTrusted: true },
      });
      await this.prisma.user.update({
        where: { id: params.userId },
        data: { trustedDeviceId: params.deviceId },
      });
    }

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_PAYMENT_APPROVAL_APPROVED',
      metadata: {
        approvalId: approval.id,
        restaurantId: approval.restaurantId,
        amount: approval.amount.toString(),
        deviceId: params.deviceId,
      } as Prisma.InputJsonValue,
    });

    emitToUser(params.userId, 'PAYMENT_REQUEST_RESOLVED', {
      approvalId: approval.id,
      status: 'approved',
      userBalanceAfter: payResult.userBalanceAfter,
    });

    // Best-effort notifications for both sides (do not affect payment success).
    try {
      const [restaurant, payer] = await Promise.all([
        this.prisma.restaurant.findUnique({
          where: { id: approval.restaurantId },
          select: { id: true, name: true, userId: true },
        }),
        this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { fullName: true, email: true },
        }),
      ]);

      const restaurantName = restaurant?.name ?? 'Restaurant';
      const amountText = `${approval.amount.toString()} ${approval.currency}`;
      const payerName = payer?.fullName?.trim() || payer?.email || 'Customer';

      await sendNotificationToUser({
        userId: params.userId,
        title: 'Wallet payment successful',
        body: `Paid ${amountText} to ${restaurantName}.`,
        type: 'PAYMENT',
      });

      if (restaurant?.userId) {
        await sendNotificationToUser({
          userId: restaurant.userId,
          title: 'New wallet payment received',
          body: `Received ${amountText} from ${payerName}.`,
          type: 'PAYMENT',
        });
      }
    } catch (notifyErr) {
      // Payment already completed; notification failures are logged only.
      console.error('wallet approval notifications failed:', notifyErr);
    }

    return payResult;
  }
}

const prismaSingleton = new PrismaClient();
const auditSingleton = new AuditService(prismaSingleton);

export const paymentApprovalService = new PaymentApprovalService(prismaSingleton, auditSingleton);
