import {
  Prisma,
  PrismaClient,
  WalletLedgerEntry,
  WalletLedgerSource,
  WalletOwnerType,
  WalletWithdrawalStatus,
} from '@prisma/client';
import { WalletRepository } from '../repositories/wallet.repository';
import { AuditService } from './audit.service';
import { formatWalletAmountForApi } from '../utils/formatAmount';

const LARGE_PAYMENT_EUR = new Prisma.Decimal(1000);
const RAPID_WINDOW_MS = 60_000;
const RAPID_MAX_OPS = 8;

export class InsufficientBalanceError extends Error {
  constructor() {
    super('INSUFFICIENT_BALANCE');
    this.name = 'InsufficientBalanceError';
  }
}

export class WalletValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletValidationError';
  }
}

export class WalletService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: WalletRepository,
    private readonly audit: AuditService,
  ) {}

  private async fraudHints(params: {
    userId: string;
    amount: Prisma.Decimal;
    ip?: string | null;
  }): Promise<Prisma.InputJsonValue> {
    const flags: Record<string, boolean> = {};
    if (params.amount.gte(LARGE_PAYMENT_EUR)) {
      flags.largeTransaction = true;
    }
    const since = new Date(Date.now() - RAPID_WINDOW_MS);
    const recent = await this.prisma.auditLog.count({
      where: {
        userId: params.userId,
        action: {
          in: [
            'WALLET_PAY',
            'WALLET_TOPUP_STRIPE',
            'WALLET_WITHDRAW_REQUEST',
            'RESTAURANT_WALLET_TOPUP_STRIPE',
            'RESTAURANT_WALLET_WITHDRAW_REQUEST',
          ],
        },
        createdAt: { gte: since },
      },
    });
    if (recent >= RAPID_MAX_OPS) {
      flags.rapidRepeatedActions = true;
    }
    if (params.ip != null && params.ip !== '') {
      const distinctIps = await this.prisma.auditLog.findMany({
        where: {
          userId: params.userId,
          createdAt: { gte: since },
          ipAddress: { not: null },
        },
        select: { ipAddress: true },
        distinct: ['ipAddress'],
        take: 10,
      });
      if (distinctIps.length >= 3) {
        flags.multipleIpChanges = true;
      }
    }
    return flags as unknown as Prisma.InputJsonValue;
  }

  async getUserWalletBalance(userId: string): Promise<{
    balance: string;
    currency: string;
  }> {
    const row = await this.repo.getBalanceByOwner('USER', userId);
    if (!row) {
      return { balance: '0', currency: 'EUR' };
    }
    return { balance: formatWalletAmountForApi(row.balance), currency: row.currency };
  }

  async getRestaurantWalletBalance(restaurantId: string): Promise<{
    balance: string;
    currency: string;
  }> {
    const row = await this.repo.getBalanceByOwner('RESTAURANT', restaurantId);
    if (!row) {
      return { balance: '0', currency: 'EUR' };
    }
    return { balance: formatWalletAmountForApi(row.balance), currency: row.currency };
  }

  async listUserLedger(userId: string, take: number, cursor?: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'USER', ownerId: userId } },
    });
    if (!wallet) {
      return [];
    }
    const rows = await this.repo.listLedgerForWallet(wallet.id, take, cursor);
    return rows.map((e) => ({
      ...e,
      amount: formatWalletAmountForApi(e.amount),
    }));
  }

  async listRestaurantLedger(restaurantId: string, take: number, cursor?: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'RESTAURANT', ownerId: restaurantId } },
    });
    if (!wallet) {
      return [];
    }
    const rows = await this.repo.listLedgerForWallet(wallet.id, take, cursor);
    return rows.map((e) => ({
      ...e,
      amount: formatWalletAmountForApi(e.amount),
    }));
  }

  async listRestaurantLedgerPaged(params: {
    restaurantId: string;
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    entries: Array<Omit<WalletLedgerEntry, 'amount'> & { amount: string }>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    currency: string;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'RESTAURANT', ownerId: params.restaurantId } },
    });
    if (!wallet) {
      return {
        entries: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: params.limit,
          hasNextPage: false,
          hasPrevPage: false,
        },
        currency: 'EUR',
      };
    }
    const range: { start?: Date; end?: Date } | undefined =
      params.startDate !== undefined || params.endDate !== undefined
        ? {
            ...(params.startDate !== undefined ? { start: params.startDate } : {}),
            ...(params.endDate !== undefined ? { end: params.endDate } : {}),
          }
        : undefined;
    const totalItems = await this.repo.countLedgerCompleted(wallet.id, range);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / params.limit);
    const currentPage =
      totalItems === 0 ? 1 : Math.min(Math.max(1, params.page), totalPages);
    const skip = totalItems === 0 ? 0 : (currentPage - 1) * params.limit;
    const rows = await this.repo.listLedgerCompletedPage(wallet.id, {
      skip,
      take: params.limit,
      ...(range ?? {}),
    });
    const entries = rows.map((e) => ({
      ...e,
      amount: formatWalletAmountForApi(e.amount),
    }));
    return {
      entries,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage: params.limit,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPrevPage: totalPages > 0 && currentPage > 1,
      },
      currency: wallet.currency,
    };
  }

  async getRestaurantLedgerStats(params: {
    restaurantId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalEntries: number;
    creditsTotal: string;
    debitsTotal: string;
    netChange: string;
    currency: string;
    entriesToday: number;
    entriesThisWeek: number;
    entriesThisMonth: number;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'RESTAURANT', ownerId: params.restaurantId } },
    });
    const empty = {
      totalEntries: 0,
      creditsTotal: '0',
      debitsTotal: '0',
      netChange: '0',
      currency: 'EUR',
      entriesToday: 0,
      entriesThisWeek: 0,
      entriesThisMonth: 0,
    };
    if (!wallet) {
      return empty;
    }
    const range: { start?: Date; end?: Date } | undefined =
      params.startDate !== undefined || params.endDate !== undefined
        ? {
            ...(params.startDate !== undefined ? { start: params.startDate } : {}),
            ...(params.endDate !== undefined ? { end: params.endDate } : {}),
          }
        : undefined;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);

    const [
      totalEntries,
      creditsSum,
      debitsSum,
      entriesToday,
      entriesThisWeek,
      entriesThisMonth,
    ] = await Promise.all([
      this.repo.countLedgerCompleted(wallet.id, range),
      this.repo.sumLedgerCompletedByType(wallet.id, 'CREDIT', range),
      this.repo.sumLedgerCompletedByType(wallet.id, 'DEBIT', range),
      this.repo.countLedgerCompletedSince(wallet.id, today),
      this.repo.countLedgerCompletedSince(wallet.id, thisWeek),
      this.repo.countLedgerCompletedSince(wallet.id, thisMonth),
    ]);

    const net = creditsSum.minus(debitsSum);
    return {
      totalEntries,
      creditsTotal: formatWalletAmountForApi(creditsSum),
      debitsTotal: formatWalletAmountForApi(debitsSum),
      netChange: formatWalletAmountForApi(net),
      currency: wallet.currency,
      entriesToday,
      entriesThisWeek,
      entriesThisMonth,
    };
  }

  /**
   * Stripe webhook: idempotent credit from payment_intent.succeeded
   */
  async applyStripeTopUp(params: {
    paymentIntentId: string;
    amountReceivedCents: number;
    currency: string;
    userId: string;
    metadata?: Record<string, string> | null;
  }): Promise<{ ok: boolean; duplicate?: boolean }> {
    const idempotencyKey = `stripe_pi_${params.paymentIntentId}`;
    const amount = new Prisma.Decimal(params.amountReceivedCents).div(100);

    const existing = await this.prisma.walletLedgerEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new WalletValidationError('User not found for wallet top-up');
    }

    const fraud = await this.fraudHints({ userId: params.userId, amount, ip: null });
    const currency =
      params.currency.toUpperCase() === 'EUR' ? 'EUR' : params.currency.toUpperCase();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const dup = await this.repo.findLedgerByIdempotencyKey(tx, idempotencyKey);
          if (dup) return;

          const wallet = await this.repo.getOrCreateWallet(tx, 'USER', params.userId, currency);

          await this.repo.createLedgerEntry(tx, {
            walletId: wallet.id,
            type: 'CREDIT',
            amount,
            status: 'COMPLETED',
            source: 'STRIPE',
            referenceId: params.paymentIntentId,
            idempotencyKey,
        metadata: {
          stripe: true,
          currency: params.currency,
          fraudFlags: fraud,
        } as Prisma.InputJsonValue,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        return { ok: true, duplicate: true };
      }
      throw e;
    }

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_TOPUP_STRIPE',
      metadata: {
        paymentIntentId: params.paymentIntentId,
        amount: amount.toString(),
        fraudFlags: fraud,
      } as Prisma.InputJsonValue,
    });

    return { ok: true };
  }

  /**
   * Stripe top-up credits the restaurant ledger wallet (same idempotency key pattern as user top-up).
   */
  async applyStripeRestaurantTopUp(params: {
    paymentIntentId: string;
    amountReceivedCents: number;
    currency: string;
    restaurantId: string;
    metadata?: Record<string, string> | null;
  }): Promise<{ ok: boolean; duplicate?: boolean }> {
    const idempotencyKey = `stripe_pi_${params.paymentIntentId}`;
    const amount = new Prisma.Decimal(params.amountReceivedCents).div(100);

    const existing = await this.prisma.walletLedgerEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: params.restaurantId },
      select: { id: true, userId: true },
    });
    if (!restaurant) {
      throw new WalletValidationError('Restaurant not found for wallet top-up');
    }

    const fraud = await this.fraudHints({
      userId: restaurant.userId,
      amount,
      ip: null,
    });
    const currency =
      params.currency.toUpperCase() === 'EUR' ? 'EUR' : params.currency.toUpperCase();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const dup = await this.repo.findLedgerByIdempotencyKey(tx, idempotencyKey);
          if (dup) return;

          const wallet = await this.repo.getOrCreateWallet(
            tx,
            'RESTAURANT',
            params.restaurantId,
            currency,
          );

          await this.repo.createLedgerEntry(tx, {
            walletId: wallet.id,
            type: 'CREDIT',
            amount,
            status: 'COMPLETED',
            source: 'STRIPE',
            referenceId: params.paymentIntentId,
            idempotencyKey,
            metadata: {
              stripe: true,
              currency: params.currency,
              restaurantId: params.restaurantId,
              fraudFlags: fraud,
            } as Prisma.InputJsonValue,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        return { ok: true, duplicate: true };
      }
      throw e;
    }

    await this.audit.log({
      userId: restaurant.userId,
      action: 'RESTAURANT_WALLET_TOPUP_STRIPE',
      metadata: {
        paymentIntentId: params.paymentIntentId,
        restaurantId: params.restaurantId,
        amount: amount.toString(),
        fraudFlags: fraud,
      } as Prisma.InputJsonValue,
    });

    return { ok: true };
  }

  /**
   * Atomic transfer: user wallet -> restaurant wallet
   */
  async payRestaurant(params: {
    userId: string;
    restaurantId: string;
    amount: Prisma.Decimal;
    currency?: string;
    idempotencyKey?: string | null;
    ipAddress?: string | null;
    deviceInfo?: string | null;
    orderReference?: string | null;
  }): Promise<{ userBalanceAfter: string }> {
    if (params.amount.lte(0)) {
      throw new WalletValidationError('Amount must be positive');
    }

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: params.restaurantId, isActive: true },
    });
    if (!restaurant) {
      throw new WalletValidationError('Restaurant not found or inactive');
    }

    const curr = params.currency ?? 'EUR';
    const fraud = await this.fraudHints({
      userId: params.userId,
      amount: params.amount,
      ip: params.ipAddress ?? null,
    });

    const idem = params.idempotencyKey
      ? `wallet_pay_${params.idempotencyKey}`
      : undefined;
    if (idem) {
      const existing = await this.prisma.walletLedgerEntry.findUnique({
        where: { idempotencyKey: idem },
      });
      if (existing) {
        const bal = await this.repo.getBalanceByOwner('USER', params.userId);
        return {
          userBalanceAfter: bal ? formatWalletAmountForApi(bal.balance) : '0',
        };
      }
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const userWallet = await this.repo.getOrCreateWallet(tx, 'USER', params.userId, curr);
        const restWallet = await this.repo.getOrCreateWallet(
          tx,
          'RESTAURANT',
          params.restaurantId,
          curr,
        );

        const balance = await this.repo.getBalance(tx, userWallet.id);
        if (balance.lt(params.amount)) {
          throw new InsufficientBalanceError();
        }

        const meta = {
          restaurantId: params.restaurantId,
          ...(params.orderReference != null ? { orderReference: params.orderReference } : {}),
          fraudFlags: fraud,
        } as Prisma.InputJsonValue;

        await this.repo.createLedgerEntry(tx, {
          walletId: userWallet.id,
          type: 'DEBIT',
          amount: params.amount,
          status: 'COMPLETED',
          source: 'ORDER',
          referenceId: params.orderReference ?? params.restaurantId,
          idempotencyKey: idem ?? null,
          metadata: meta,
        });

        await this.repo.createLedgerEntry(tx, {
          walletId: restWallet.id,
          type: 'CREDIT',
          amount: params.amount,
          status: 'COMPLETED',
          source: 'ORDER',
          referenceId: params.orderReference ?? params.userId,
          metadata: {
            userId: params.userId,
            restaurantId: params.restaurantId,
            ...(params.orderReference != null ? { orderReference: params.orderReference } : {}),
            fraudFlags: fraud,
          } as Prisma.InputJsonValue,
        });

        const after = await this.repo.getBalance(tx, userWallet.id);
        return { userBalanceAfter: formatWalletAmountForApi(after) };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_PAY',
      ...(params.ipAddress != null && params.ipAddress !== ''
        ? { ipAddress: params.ipAddress }
        : {}),
      ...(params.deviceInfo != null && params.deviceInfo !== ''
        ? { deviceInfo: params.deviceInfo }
        : {}),
      metadata: {
        restaurantId: params.restaurantId,
        amount: params.amount.toString(),
        fraudFlags: fraud,
      } as Prisma.InputJsonValue,
    });

    return result;
  }

  async requestWithdrawal(params: {
    userId: string;
    amount: Prisma.Decimal;
    currency?: string;
    accountInfo: Prisma.InputJsonValue;
    ipAddress?: string | null;
    deviceInfo?: string | null;
  }): Promise<{ id: string }> {
    if (params.amount.lte(0)) {
      throw new WalletValidationError('Amount must be positive');
    }

    const balanceRow = await this.repo.getBalanceByOwner('USER', params.userId);
    const available = balanceRow?.balance ?? new Prisma.Decimal(0);
    if (available.lt(params.amount)) {
      throw new InsufficientBalanceError();
    }

    const fraud = await this.fraudHints({
      userId: params.userId,
      amount: params.amount,
      ip: params.ipAddress ?? null,
    });

    const w = await this.prisma.walletWithdrawal.create({
      data: {
        userId: params.userId,
        restaurantId: null,
        amount: params.amount,
        currency: params.currency ?? 'EUR',
        status: 'PENDING',
        accountInfo: params.accountInfo,
      },
    });

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_WITHDRAW_REQUEST',
      ...(params.ipAddress != null && params.ipAddress !== ''
        ? { ipAddress: params.ipAddress }
        : {}),
      ...(params.deviceInfo != null && params.deviceInfo !== ''
        ? { deviceInfo: params.deviceInfo }
        : {}),
      metadata: {
        withdrawalId: w.id,
        amount: params.amount.toString(),
        fraudFlags: fraud,
      } as Prisma.InputJsonValue,
    });

    return { id: w.id };
  }

  async requestRestaurantWithdrawal(params: {
    restaurantId: string;
    ownerUserId: string;
    amount: Prisma.Decimal;
    currency?: string;
    accountInfo: Prisma.InputJsonValue;
    ipAddress?: string | null;
    deviceInfo?: string | null;
  }): Promise<{ id: string }> {
    if (params.amount.lte(0)) {
      throw new WalletValidationError('Amount must be positive');
    }

    const balanceRow = await this.repo.getBalanceByOwner('RESTAURANT', params.restaurantId);
    const available = balanceRow?.balance ?? new Prisma.Decimal(0);
    if (available.lt(params.amount)) {
      throw new InsufficientBalanceError();
    }

    const fraud = await this.fraudHints({
      userId: params.ownerUserId,
      amount: params.amount,
      ip: params.ipAddress ?? null,
    });

    const w = await this.prisma.walletWithdrawal.create({
      data: {
        userId: null,
        restaurantId: params.restaurantId,
        amount: params.amount,
        currency: params.currency ?? 'EUR',
        status: 'PENDING',
        accountInfo: params.accountInfo,
      },
    });

    await this.audit.log({
      userId: params.ownerUserId,
      action: 'RESTAURANT_WALLET_WITHDRAW_REQUEST',
      ...(params.ipAddress != null && params.ipAddress !== ''
        ? { ipAddress: params.ipAddress }
        : {}),
      ...(params.deviceInfo != null && params.deviceInfo !== ''
        ? { deviceInfo: params.deviceInfo }
        : {}),
      metadata: {
        withdrawalId: w.id,
        restaurantId: params.restaurantId,
        amount: params.amount.toString(),
        fraudFlags: fraud,
      } as Prisma.InputJsonValue,
    });

    return { id: w.id };
  }

  async approveWithdrawal(params: {
    withdrawalId: string;
    adminId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.walletWithdrawal.findUnique({
        where: { id: params.withdrawalId },
      });
      if (!w || w.status !== 'PENDING') {
        throw new WalletValidationError('Invalid withdrawal');
      }

      const idempotencyKey = `withdrawal_${w.id}`;
      const existing = await this.repo.findLedgerByIdempotencyKey(tx, idempotencyKey);
      if (existing) {
        await tx.walletWithdrawal.update({
          where: { id: w.id },
          data: { status: 'COMPLETED', adminId: params.adminId, reviewedAt: new Date() },
        });
        return;
      }

      const ownerType = w.restaurantId ? ('RESTAURANT' as const) : ('USER' as const);
      const ownerId = w.restaurantId ?? w.userId;
      if (!ownerId) {
        throw new WalletValidationError('Invalid withdrawal: missing owner');
      }

      const wallet = await this.repo.getOrCreateWallet(tx, ownerType, ownerId, w.currency);

      const balance = await this.repo.getBalance(tx, wallet.id);
      if (balance.lt(w.amount)) {
        throw new InsufficientBalanceError();
      }

      await this.repo.createLedgerEntry(tx, {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: w.amount,
        status: 'COMPLETED',
        source: 'WITHDRAWAL',
        referenceId: w.id,
        idempotencyKey,
        metadata: {
          withdrawalId: w.id,
          adminId: params.adminId,
          ...(w.restaurantId ? { restaurantId: w.restaurantId } : {}),
        } as Prisma.InputJsonValue,
      });

      await tx.walletWithdrawal.update({
        where: { id: w.id },
        data: {
          status: 'COMPLETED',
          adminId: params.adminId,
          reviewedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      userId: params.adminId,
      action: 'WALLET_WITHDRAW_APPROVE',
      metadata: { withdrawalId: params.withdrawalId } as Prisma.InputJsonValue,
    });
  }

  async rejectWithdrawal(params: {
    withdrawalId: string;
    adminId: string;
    reason?: string;
  }): Promise<void> {
    const w = await this.prisma.walletWithdrawal.findUnique({
      where: { id: params.withdrawalId },
    });
    if (!w || w.status !== 'PENDING') {
      throw new WalletValidationError('Invalid withdrawal');
    }
    const baseInfo =
      w.accountInfo != null && typeof w.accountInfo === 'object' && !Array.isArray(w.accountInfo)
        ? (w.accountInfo as Record<string, unknown>)
        : {};
    await this.prisma.walletWithdrawal.update({
      where: { id: params.withdrawalId },
      data: {
        status: 'REJECTED',
        adminId: params.adminId,
        reviewedAt: new Date(),
        accountInfo: {
          ...baseInfo,
          ...(params.reason != null ? { rejectReason: params.reason } : {}),
        },
      },
    });
    await this.audit.log({
      userId: params.adminId,
      action: 'WALLET_WITHDRAW_REJECT',
      metadata: {
        withdrawalId: params.withdrawalId,
        ...(params.reason != null ? { reason: params.reason } : {}),
      } as Prisma.InputJsonValue,
    });
  }

  async listPendingWithdrawals(take = 50) {
    return this.prisma.walletWithdrawal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        restaurant: {
          select: {
            id: true,
            name: true,
            owner: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });
  }
}

const prismaSingleton = new PrismaClient();
const repoSingleton = new WalletRepository(prismaSingleton);
const auditSingleton = new AuditService(prismaSingleton);

export const walletService = new WalletService(prismaSingleton, repoSingleton, auditSingleton);
