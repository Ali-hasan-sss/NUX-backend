import {
  Prisma,
  PrismaClient,
  WalletLedgerEntry,
  WalletLedgerSource,
  WalletOwnerType,
  WalletWithdrawalStatus,
} from '@prisma/client';
import {
  WalletRepository,
  withdrawalHoldIdempotencyKey,
} from '../repositories/wallet.repository';
import { AuditService } from './audit.service';
import {
  sendNotificationToUser,
  sendNotificationToUsersBulk,
} from '../../services/notification.service';
import { formatWalletAmountForApi } from '../utils/formatAmount';

const LARGE_PAYMENT_EUR = new Prisma.Decimal(1000);
const RAPID_WINDOW_MS = 60_000;
const RAPID_MAX_OPS = 8;

/** Self-service withdrawal requests (user / restaurant) must be at least this amount in EUR. Smaller payouts only via admin. */
export const MIN_SELF_SERVICE_WITHDRAWAL_EUR = new Prisma.Decimal(200);

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

  /** In-app withdrawal flow: minimum 200 EUR (wallet currency EUR). */
  private assertMinSelfServiceWithdrawal(amount: Prisma.Decimal, currency: string): void {
    const ccy = (currency || 'EUR').toUpperCase();
    if (ccy !== 'EUR') {
      throw new WalletValidationError('SELF_SERVICE_WITHDRAWAL_EUR_ONLY');
    }
    if (amount.lt(MIN_SELF_SERVICE_WITHDRAWAL_EUR)) {
      throw new WalletValidationError('MIN_WITHDRAWAL_200_EUR');
    }
  }

  async getUserWalletBalance(userId: string): Promise<{
    balance: string;
    currency: string;
  }> {
    const row = await this.repo.getAvailableBalanceByOwner('USER', userId);
    if (!row) {
      return { balance: '0', currency: 'EUR' };
    }
    return { balance: formatWalletAmountForApi(row.balance), currency: row.currency };
  }

  async getRestaurantWalletBalance(restaurantId: string): Promise<{
    balance: string;
    currency: string;
  }> {
    const row = await this.repo.getAvailableBalanceByOwner('RESTAURANT', restaurantId);
    if (!row) {
      return { balance: '0', currency: 'EUR' };
    }
    return { balance: formatWalletAmountForApi(row.balance), currency: row.currency };
  }

  async getUserWalletBalanceDetailForAdmin(userId: string): Promise<{
    user: {
      id: string;
      email: string;
      fullName: string | null;
      role: string;
      isActive: boolean;
      createdAt: Date;
      isRestaurant: boolean;
    };
    wallet: {
      currency: string;
      availableBalance: string;
      ledgerCompletedBalance: string;
      pendingWithdrawalHold: string;
    };
    minSelfServiceWithdrawalEur: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        isRestaurant: true,
      },
    });
    if (!user) {
      throw new WalletValidationError('USER_NOT_FOUND');
    }

    const walletRow = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'USER', ownerId: userId } },
    });
    let currency = 'EUR';
    let ledgerCompleted = new Prisma.Decimal(0);
    let pendingHold = new Prisma.Decimal(0);
    if (walletRow) {
      currency = walletRow.currency;
      ledgerCompleted = await this.repo.getBalance(this.prisma, walletRow.id);
      pendingHold = await this.repo.sumPendingWithdrawalHolds(this.prisma, walletRow.id);
    }
    const availRow = await this.repo.getAvailableBalanceByOwner('USER', userId);
    const available = availRow?.balance ?? new Prisma.Decimal(0);
    if (availRow) {
      currency = availRow.currency;
    }

    return {
      user,
      wallet: {
        currency,
        availableBalance: formatWalletAmountForApi(available),
        ledgerCompletedBalance: formatWalletAmountForApi(ledgerCompleted),
        pendingWithdrawalHold: formatWalletAmountForApi(pendingHold),
      },
      minSelfServiceWithdrawalEur: formatWalletAmountForApi(MIN_SELF_SERVICE_WITHDRAWAL_EUR),
    };
  }

  async getRestaurantWalletBalanceDetailForAdmin(restaurantId: string): Promise<{
    restaurant: {
      id: string;
      name: string;
      isActive: boolean;
      currency: string | null;
      owner: { id: string; email: string; fullName: string | null };
    };
    wallet: {
      currency: string;
      availableBalance: string;
      ledgerCompletedBalance: string;
      pendingWithdrawalHold: string;
    };
    minSelfServiceWithdrawalEur: string;
  }> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        currency: true,
        owner: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!restaurant) {
      throw new WalletValidationError('RESTAURANT_NOT_FOUND');
    }

    const walletRow = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'RESTAURANT', ownerId: restaurantId } },
    });
    let currency = restaurant.currency?.toUpperCase() || 'EUR';
    let ledgerCompleted = new Prisma.Decimal(0);
    let pendingHold = new Prisma.Decimal(0);
    if (walletRow) {
      currency = walletRow.currency;
      ledgerCompleted = await this.repo.getBalance(this.prisma, walletRow.id);
      pendingHold = await this.repo.sumPendingWithdrawalHolds(this.prisma, walletRow.id);
    }
    const availRow = await this.repo.getAvailableBalanceByOwner('RESTAURANT', restaurantId);
    const available = availRow?.balance ?? new Prisma.Decimal(0);
    if (availRow) {
      currency = availRow.currency;
    }

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        isActive: restaurant.isActive,
        currency: restaurant.currency,
        owner: restaurant.owner,
      },
      wallet: {
        currency,
        availableBalance: formatWalletAmountForApi(available),
        ledgerCompletedBalance: formatWalletAmountForApi(ledgerCompleted),
        pendingWithdrawalHold: formatWalletAmountForApi(pendingHold),
      },
      minSelfServiceWithdrawalEur: formatWalletAmountForApi(MIN_SELF_SERVICE_WITHDRAWAL_EUR),
    };
  }

  /** App customers (role USER) for admin wallet UI pickers. */
  async listAppUsersForAdminWalletSelect(params: {
    search?: string;
    take?: number;
  }): Promise<{
    items: Array<{ id: string; email: string; fullName: string | null }>;
  }> {
    const take = Math.min(Math.max(params.take ?? 200, 1), 300);
    const q = params.search?.trim();
    const where: Prisma.UserWhereInput = { role: 'USER' };
    if (q && q.length > 0) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const items = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, fullName: true },
      orderBy: { email: 'asc' },
      take,
    });
    return { items };
  }

  /** Restaurants for admin wallet UI pickers. */
  async listRestaurantsForAdminWalletSelect(params: {
    search?: string;
    take?: number;
  }): Promise<{
    items: Array<{ id: string; name: string; ownerEmail: string }>;
  }> {
    const take = Math.min(Math.max(params.take ?? 200, 1), 300);
    const q = params.search?.trim();
    const where: Prisma.RestaurantWhereInput = {};
    if (q && q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { owner: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.restaurant.findMany({
      where,
      select: { id: true, name: true, owner: { select: { email: true } } },
      orderBy: { name: 'asc' },
      take,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        ownerEmail: r.owner.email,
      })),
    };
  }

  async adminManualWalletDebit(params: {
    adminId: string;
    ownerType: WalletOwnerType;
    ownerId: string;
    amount: Prisma.Decimal;
    currency?: string;
    note?: string | null;
    idempotencyKey?: string | null;
  }): Promise<{ availableBalanceAfter: string; currency: string }> {
    if (params.amount.lte(0)) {
      throw new WalletValidationError('Amount must be positive');
    }
    if (params.ownerType !== 'USER' && params.ownerType !== 'RESTAURANT') {
      throw new WalletValidationError('Invalid owner type');
    }

    if (params.ownerType === 'USER') {
      const exists = await this.prisma.user.findUnique({
        where: { id: params.ownerId },
        select: { id: true },
      });
      if (!exists) {
        throw new WalletValidationError('USER_NOT_FOUND');
      }
    } else {
      const exists = await this.prisma.restaurant.findUnique({
        where: { id: params.ownerId },
        select: { id: true },
      });
      if (!exists) {
        throw new WalletValidationError('RESTAURANT_NOT_FOUND');
      }
    }

    const curr = params.currency ?? 'EUR';
    const idemRaw = params.idempotencyKey?.trim();
    const idem =
      idemRaw && idemRaw.length > 0 ? `admin_manual_debit_${idemRaw}` : null;

    if (idem) {
      const existing = await this.prisma.walletLedgerEntry.findUnique({
        where: { idempotencyKey: idem },
      });
      if (existing) {
        const row = await this.repo.getAvailableBalanceByOwner(
          params.ownerType,
          params.ownerId,
        );
        return {
          availableBalanceAfter: row
            ? formatWalletAmountForApi(row.balance)
            : '0',
          currency: row?.currency ?? curr,
        };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const wallet = await this.repo.getOrCreateWallet(tx, params.ownerType, params.ownerId, curr);
      const available = await this.repo.getAvailableBalance(tx, wallet.id);
      if (available.lt(params.amount)) {
        throw new InsufficientBalanceError();
      }

      await this.repo.createLedgerEntry(tx, {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: params.amount,
        status: 'COMPLETED',
        source: 'ADMIN',
        referenceId: params.adminId,
        ...(idem ? { idempotencyKey: idem } : {}),
        metadata: {
          adminManualDebit: true,
          adminId: params.adminId,
          note: params.note ?? undefined,
        } as Prisma.InputJsonValue,
      });
    });

    const row = await this.repo.getAvailableBalanceByOwner(params.ownerType, params.ownerId);
    const after = row?.balance ?? new Prisma.Decimal(0);

    await this.audit.log({
      userId: params.adminId,
      action: 'ADMIN_WALLET_MANUAL_DEBIT',
      metadata: {
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        amount: params.amount.toString(),
        currency: curr,
        note: params.note ?? null,
        ...(idem ? { idempotencyKey: idem } : {}),
      } as Prisma.InputJsonValue,
    });

    return {
      availableBalanceAfter: formatWalletAmountForApi(after),
      currency: row?.currency ?? curr,
    };
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
        const bal = await this.repo.getAvailableBalanceByOwner('USER', params.userId);
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

        const balance = await this.repo.getAvailableBalance(tx, userWallet.id);
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

        const after = await this.repo.getAvailableBalance(tx, userWallet.id);
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

    const currency = params.currency ?? 'EUR';
    this.assertMinSelfServiceWithdrawal(params.amount, currency);

    const fraud = await this.fraudHints({
      userId: params.userId,
      amount: params.amount,
      ip: params.ipAddress ?? null,
    });

    const w = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.repo.getOrCreateWallet(tx, 'USER', params.userId, currency);
      const available = await this.repo.getAvailableBalance(tx, wallet.id);
      if (available.lt(params.amount)) {
        throw new InsufficientBalanceError();
      }

      const created = await tx.walletWithdrawal.create({
        data: {
          userId: params.userId,
          restaurantId: null,
          amount: params.amount,
          currency,
          status: 'PENDING',
          accountInfo: params.accountInfo,
        },
      });

      await this.repo.createLedgerEntry(tx, {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: params.amount,
        status: 'PENDING',
        source: 'WITHDRAWAL',
        referenceId: created.id,
        idempotencyKey: withdrawalHoldIdempotencyKey(created.id),
        metadata: {
          withdrawalId: created.id,
          hold: true,
          fraudFlags: fraud,
        } as Prisma.InputJsonValue,
      });

      return created;
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

    await this.notifyAdminsNewWithdrawalPending(w, 'مستخدم');

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

    const currency = params.currency ?? 'EUR';
    this.assertMinSelfServiceWithdrawal(params.amount, currency);

    const fraud = await this.fraudHints({
      userId: params.ownerUserId,
      amount: params.amount,
      ip: params.ipAddress ?? null,
    });

    const w = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.repo.getOrCreateWallet(
        tx,
        'RESTAURANT',
        params.restaurantId,
        currency,
      );
      const available = await this.repo.getAvailableBalance(tx, wallet.id);
      if (available.lt(params.amount)) {
        throw new InsufficientBalanceError();
      }

      const created = await tx.walletWithdrawal.create({
        data: {
          userId: null,
          restaurantId: params.restaurantId,
          amount: params.amount,
          currency,
          status: 'PENDING',
          accountInfo: params.accountInfo,
        },
      });

      await this.repo.createLedgerEntry(tx, {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: params.amount,
        status: 'PENDING',
        source: 'WITHDRAWAL',
        referenceId: created.id,
        idempotencyKey: withdrawalHoldIdempotencyKey(created.id),
        metadata: {
          withdrawalId: created.id,
          hold: true,
          restaurantId: params.restaurantId,
          fraudFlags: fraud,
        } as Prisma.InputJsonValue,
      });

      return created;
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

    const rest = await this.prisma.restaurant.findUnique({
      where: { id: params.restaurantId },
      select: { name: true },
    });
    await this.notifyAdminsNewWithdrawalPending(w, rest?.name ? `مطعم: ${rest.name}` : 'مطعم');

    return { id: w.id };
  }

  async approveWithdrawal(params: {
    withdrawalId: string;
    adminId: string;
  }): Promise<void> {
    type ApprovedPayload = {
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      userId: string | null;
      restaurantId: string | null;
    };

    const approved = await this.prisma.$transaction(async (tx): Promise<ApprovedPayload> => {
      const w = await tx.walletWithdrawal.findUnique({
        where: { id: params.withdrawalId },
      });
      if (!w || w.status !== 'PENDING') {
        throw new WalletValidationError('Invalid withdrawal');
      }

      const payload: ApprovedPayload = {
        id: w.id,
        amount: w.amount,
        currency: w.currency,
        userId: w.userId,
        restaurantId: w.restaurantId,
      };

      const legacyKey = `withdrawal_${w.id}`;
      const legacyExisting = await this.repo.findLedgerByIdempotencyKey(tx, legacyKey);
      if (legacyExisting) {
        await tx.walletWithdrawal.update({
          where: { id: w.id },
          data: { status: 'COMPLETED', adminId: params.adminId, reviewedAt: new Date() },
        });
        return payload;
      }

      const ownerType = w.restaurantId ? ('RESTAURANT' as const) : ('USER' as const);
      const ownerId = w.restaurantId ?? w.userId;
      if (!ownerId) {
        throw new WalletValidationError('Invalid withdrawal: missing owner');
      }

      const wallet = await this.repo.getOrCreateWallet(tx, ownerType, ownerId, w.currency);
      const holdKey = withdrawalHoldIdempotencyKey(w.id);
      const hold = await this.repo.findLedgerByIdempotencyKey(tx, holdKey);

      if (hold && hold.status === 'PENDING' && hold.walletId === wallet.id) {
        const prevMeta =
          hold.metadata != null && typeof hold.metadata === 'object' && !Array.isArray(hold.metadata)
            ? (hold.metadata as Record<string, unknown>)
            : {};
        await tx.walletLedgerEntry.update({
          where: { id: hold.id },
          data: {
            status: 'COMPLETED',
            metadata: {
              ...prevMeta,
              withdrawalId: w.id,
              adminId: params.adminId,
              holdReleased: true,
            } as Prisma.InputJsonValue,
          },
        });
      } else {
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
          idempotencyKey: legacyKey,
          metadata: {
            withdrawalId: w.id,
            adminId: params.adminId,
            ...(w.restaurantId ? { restaurantId: w.restaurantId } : {}),
          } as Prisma.InputJsonValue,
        });
      }

      await tx.walletWithdrawal.update({
        where: { id: w.id },
        data: {
          status: 'COMPLETED',
          adminId: params.adminId,
          reviewedAt: new Date(),
        },
      });
      return payload;
    });

    await this.audit.log({
      userId: params.adminId,
      action: 'WALLET_WITHDRAW_APPROVE',
      metadata: { withdrawalId: params.withdrawalId } as Prisma.InputJsonValue,
    });

    const uid = await this.resolveWithdrawalNotifyUserId(approved);
    if (uid) {
      const amt = formatWalletAmountForApi(approved.amount);
      await sendNotificationToUser({
        userId: uid,
        title: 'تمت الموافقة على طلب السحب',
        body: `تمت الموافقة على سحب مبلغ ${amt} ${approved.currency}.`,
        type: 'WALLET_WITHDRAWAL_APPROVED',
        data: {
          withdrawalId: approved.id,
          amount: amt,
          currency: approved.currency,
        },
      });
    }
  }

  async rejectWithdrawal(params: {
    withdrawalId: string;
    adminId: string;
    reason: string;
  }): Promise<void> {
    const reasonTrim = params.reason?.trim() ?? '';
    if (reasonTrim.length === 0) {
      throw new WalletValidationError('REJECT_REASON_REQUIRED');
    }

    type RejectedPayload = {
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      userId: string | null;
      restaurantId: string | null;
    };

    const rejected = await this.prisma.$transaction(async (tx): Promise<RejectedPayload> => {
      const w = await tx.walletWithdrawal.findUnique({
        where: { id: params.withdrawalId },
      });
      if (!w || w.status !== 'PENDING') {
        throw new WalletValidationError('Invalid withdrawal');
      }

      const payload: RejectedPayload = {
        id: w.id,
        amount: w.amount,
        currency: w.currency,
        userId: w.userId,
        restaurantId: w.restaurantId,
      };

      await this.failPendingWithdrawalHold(tx, w, {
        rejectReason: reasonTrim,
        rejectedByAdminId: params.adminId,
      });

      const baseInfo =
        w.accountInfo != null && typeof w.accountInfo === 'object' && !Array.isArray(w.accountInfo)
          ? (w.accountInfo as Record<string, unknown>)
          : {};
      await tx.walletWithdrawal.update({
        where: { id: params.withdrawalId },
        data: {
          status: 'REJECTED',
          adminId: params.adminId,
          reviewedAt: new Date(),
          accountInfo: {
            ...baseInfo,
            rejectReason: reasonTrim,
          },
        },
      });
      return payload;
    });

    await this.audit.log({
      userId: params.adminId,
      action: 'WALLET_WITHDRAW_REJECT',
      metadata: {
        withdrawalId: params.withdrawalId,
        reason: reasonTrim,
      } as Prisma.InputJsonValue,
    });

    const uid = await this.resolveWithdrawalNotifyUserId(rejected);
    if (uid) {
      const amt = formatWalletAmountForApi(rejected.amount);
      await sendNotificationToUser({
        userId: uid,
        title: 'تم رفض طلب السحب',
        body: `تم رفض طلب سحب مبلغ ${amt} ${rejected.currency}. السبب: ${reasonTrim}`,
        type: 'WALLET_WITHDRAWAL_REJECTED',
        data: {
          withdrawalId: rejected.id,
          amount: amt,
          currency: rejected.currency,
          reason: reasonTrim,
        },
      });
    }
  }

  /**
   * Mark the pending ledger hold for a withdrawal as FAILED so reserved funds return to available balance.
   */
  private async failPendingWithdrawalHold(
    tx: Prisma.TransactionClient,
    w: {
      id: string;
      currency: string;
      userId: string | null;
      restaurantId: string | null;
    },
    extraMeta: Record<string, unknown>,
  ): Promise<void> {
    const ownerType = w.restaurantId ? ('RESTAURANT' as const) : ('USER' as const);
    const ownerId = w.restaurantId ?? w.userId;
    if (!ownerId) {
      return;
    }
    const wallet = await this.repo.getOrCreateWallet(tx, ownerType, ownerId, w.currency);
    const holdKey = withdrawalHoldIdempotencyKey(w.id);
    const hold = await this.repo.findLedgerByIdempotencyKey(tx, holdKey);
    if (!hold || hold.status !== 'PENDING' || hold.walletId !== wallet.id) {
      return;
    }
    const prevMeta =
      hold.metadata != null && typeof hold.metadata === 'object' && !Array.isArray(hold.metadata)
        ? (hold.metadata as Record<string, unknown>)
        : {};
    await tx.walletLedgerEntry.update({
      where: { id: hold.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...prevMeta,
          withdrawalId: w.id,
          ...extraMeta,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async listWithdrawalsForUser(params: { userId: string; skip: number; take: number }): Promise<{
    total: number;
    rows: Array<{
      id: string;
      amount: string;
      currency: string;
      status: WalletWithdrawalStatus;
      createdAt: Date;
      reviewedAt: Date | null;
      accountInfo: Prisma.JsonValue;
    }>;
  }> {
    const take = Math.min(Math.max(params.take, 1), 100);
    const skip = Math.max(params.skip, 0);
    const where = { userId: params.userId, restaurantId: null };
    const [total, rows] = await Promise.all([
      this.prisma.walletWithdrawal.count({ where }),
      this.prisma.walletWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          accountInfo: true,
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        ...r,
        amount: formatWalletAmountForApi(r.amount),
      })),
    };
  }

  async listWithdrawalsForRestaurant(params: {
    restaurantId: string;
    skip: number;
    take: number;
  }): Promise<{
    total: number;
    rows: Array<{
      id: string;
      amount: string;
      currency: string;
      status: WalletWithdrawalStatus;
      createdAt: Date;
      reviewedAt: Date | null;
      accountInfo: Prisma.JsonValue;
    }>;
  }> {
    const take = Math.min(Math.max(params.take, 1), 100);
    const skip = Math.max(params.skip, 0);
    const where = { restaurantId: params.restaurantId, userId: null };
    const [total, rows] = await Promise.all([
      this.prisma.walletWithdrawal.count({ where }),
      this.prisma.walletWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          accountInfo: true,
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        ...r,
        amount: formatWalletAmountForApi(r.amount),
      })),
    };
  }

  async cancelUserWithdrawal(params: { withdrawalId: string; userId: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.walletWithdrawal.findUnique({
        where: { id: params.withdrawalId },
      });
      if (
        !w ||
        w.status !== 'PENDING' ||
        w.userId !== params.userId ||
        w.restaurantId != null
      ) {
        throw new WalletValidationError('Invalid withdrawal');
      }
      await this.failPendingWithdrawalHold(tx, w, {
        cancelledByUser: true,
        cancelledByUserId: params.userId,
      });
      await tx.walletWithdrawal.update({
        where: { id: w.id },
        data: { status: 'CANCELLED', reviewedAt: new Date() },
      });
    });

    await this.audit.log({
      userId: params.userId,
      action: 'WALLET_WITHDRAW_CANCEL_USER',
      metadata: { withdrawalId: params.withdrawalId } as Prisma.InputJsonValue,
    });
  }

  async cancelRestaurantWithdrawal(params: {
    withdrawalId: string;
    restaurantId: string;
    ownerUserId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.walletWithdrawal.findUnique({
        where: { id: params.withdrawalId },
      });
      if (
        !w ||
        w.status !== 'PENDING' ||
        w.restaurantId !== params.restaurantId ||
        w.userId != null
      ) {
        throw new WalletValidationError('Invalid withdrawal');
      }
      const rest = await tx.restaurant.findUnique({
        where: { id: params.restaurantId },
        select: { userId: true },
      });
      if (!rest || rest.userId !== params.ownerUserId) {
        throw new WalletValidationError('Invalid withdrawal');
      }
      await this.failPendingWithdrawalHold(tx, w, {
        cancelledByRestaurantOwner: true,
        cancelledByUserId: params.ownerUserId,
        restaurantId: params.restaurantId,
      });
      await tx.walletWithdrawal.update({
        where: { id: w.id },
        data: { status: 'CANCELLED', reviewedAt: new Date() },
      });
    });

    await this.audit.log({
      userId: params.ownerUserId,
      action: 'WALLET_WITHDRAW_CANCEL_RESTAURANT',
      metadata: {
        withdrawalId: params.withdrawalId,
        restaurantId: params.restaurantId,
      } as Prisma.InputJsonValue,
    });
  }

  private async resolveWithdrawalNotifyUserId(w: {
    userId: string | null;
    restaurantId: string | null;
  }): Promise<string | null> {
    if (w.userId) {
      return w.userId;
    }
    if (w.restaurantId) {
      const r = await this.prisma.restaurant.findUnique({
        where: { id: w.restaurantId },
        select: { userId: true },
      });
      return r?.userId ?? null;
    }
    return null;
  }

  private async notifyAdminsNewWithdrawalPending(
    w: { id: string; amount: Prisma.Decimal; currency: string },
    kindLabel: string,
  ): Promise<void> {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUBADMIN'] }, isActive: true },
      select: { id: true },
    });
    const ids = staff.map((s) => s.id);
    if (ids.length === 0) {
      return;
    }
    const amt = formatWalletAmountForApi(w.amount);
    await sendNotificationToUsersBulk({
      userIds: ids,
      title: 'طلب سحب جديد',
      body: `${kindLabel} — ${amt} ${w.currency}`,
      type: 'WALLET_WITHDRAWAL_PENDING',
      data: {
        withdrawalId: w.id,
        amount: amt,
        currency: w.currency,
      },
    });
  }

  private static readonly LEDGER_RECON_TOLERANCE = new Prisma.Decimal('0.00000001');

  private isNearZero(d: Prisma.Decimal): boolean {
    return d.abs().lte(WalletService.LEDGER_RECON_TOLERANCE);
  }

  private withdrawalInclude() {
    return {
      user: { select: { id: true, email: true, fullName: true } },
      restaurant: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, email: true, fullName: true } },
        },
      },
    } as const;
  }

  /**
   * Paginated withdrawal list for admin (all statuses).
   * Pending rows are ordered oldest-first so approvals follow queue fairness.
   */
  async listWithdrawalsForAdmin(params: {
    status?: WalletWithdrawalStatus | 'ALL';
    skip: number;
    take: number;
  }): Promise<{
    total: number;
    rows: Prisma.WalletWithdrawalGetPayload<{ include: ReturnType<WalletService['withdrawalInclude']> }>[];
  }> {
    const take = Math.min(Math.max(params.take, 1), 200);
    const skip = Math.max(params.skip, 0);
    const status = params.status ?? 'ALL';
    const where =
      status === 'ALL'
        ? {}
        : {
            status,
          };

    const orderBy =
      status === 'PENDING' ? ({ createdAt: 'asc' } as const) : ({ createdAt: 'desc' } as const);

    const [total, rows] = await Promise.all([
      this.prisma.walletWithdrawal.count({ where }),
      this.prisma.walletWithdrawal.findMany({
        where,
        orderBy,
        skip,
        take,
        include: this.withdrawalInclude(),
      }),
    ]);

    return { total, rows };
  }

  /**
   * Admin USER-wallet dashboard: balances, lifetime credits/debits, and reconciliation checks.
   * - totalBalance: sum of current ledger balances (COMPLETED credits − debits) for app users only.
   * - Approved payouts are already recorded as DEBIT rows, so they are not added on top of totalBalance.
   * - completedUserWithdrawalsSum vs userWithdrawalDebitsFromLedgerSum: user payout rows vs USER-wallet WITHDRAWAL debits.
   * - Restaurant withdrawals use RESTAURANT wallets; same reconciliation is exposed separately per currency.
   */
  async getAdminUserWalletOverview(): Promise<{
    byCurrency: Array<{
      currency: string;
      walletCount: number;
      restaurantWalletCount: number;
      totalBalance: string;
      totalCredits: string;
      totalDebits: string;
      /** DEBIT rows not tagged WITHDRAWAL (e.g. pay-at-restaurant) — for transparency vs total debits. */
      otherDebitsFromLedgerSum: string;
      netFromLedger: string;
      ledgerReconciliationDelta: string;
      ledgerReconciliationOk: boolean;
      completedUserWithdrawalsSum: string;
      userWithdrawalDebitsFromLedgerSum: string;
      withdrawalReconciliationDelta: string;
      withdrawalReconciliationOk: boolean;
      pendingUserWithdrawalsTotal: string;
      completedRestaurantWithdrawalsSum: string;
      restaurantWithdrawalDebitsFromLedgerSum: string;
      restaurantWithdrawalReconciliationDelta: string;
      restaurantWithdrawalReconciliationOk: boolean;
      pendingRestaurantWithdrawalsTotal: string;
      /** Ledger aggregates for RESTAURANT wallets only (top-ups, payouts, etc.). */
      restaurantTotalBalance: string;
      restaurantTotalCredits: string;
      restaurantTotalDebits: string;
      restaurantOtherDebitsFromLedgerSum: string;
      restaurantNetFromLedger: string;
      restaurantLedgerReconciliationDelta: string;
      restaurantLedgerReconciliationOk: boolean;
    }>;
  }> {
    const wallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'USER' },
      select: { id: true, currency: true },
    });

    const restaurantWallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'RESTAURANT' },
      select: { id: true, currency: true },
    });

    const walletIdsByCurrency = new Map<string, string[]>();
    for (const w of wallets) {
      const cur = w.currency || 'EUR';
      const list = walletIdsByCurrency.get(cur) ?? [];
      list.push(w.id);
      walletIdsByCurrency.set(cur, list);
    }

    const restaurantWalletIdsByCurrency = new Map<string, string[]>();
    for (const w of restaurantWallets) {
      const cur = w.currency || 'EUR';
      const list = restaurantWalletIdsByCurrency.get(cur) ?? [];
      list.push(w.id);
      restaurantWalletIdsByCurrency.set(cur, list);
    }

    const userWithdrawalCurrencies = await this.prisma.walletWithdrawal.groupBy({
      by: ['currency'],
      where: { userId: { not: null } },
    });

    const restaurantWithdrawalCurrencies = await this.prisma.walletWithdrawal.groupBy({
      by: ['currency'],
      where: { restaurantId: { not: null } },
    });

    const currencySet = new Set<string>(walletIdsByCurrency.keys());
    for (const g of userWithdrawalCurrencies) {
      currencySet.add(g.currency);
    }
    for (const g of restaurantWithdrawalCurrencies) {
      currencySet.add(g.currency);
    }
    for (const cur of restaurantWalletIdsByCurrency.keys()) {
      currencySet.add(cur);
    }

    const currencies = [...currencySet].sort((a, b) => a.localeCompare(b));

    const byCurrency = await Promise.all(
      currencies.map(async (currency) => {
        const ids = walletIdsByCurrency.get(currency) ?? [];
        const restIds = restaurantWalletIdsByCurrency.get(currency) ?? [];

        let totalBalance = new Prisma.Decimal(0);
        for (const id of ids) {
          const bal = await this.repo.getBalance(this.prisma, id);
          totalBalance = totalBalance.plus(bal);
        }

        let creditsSum = new Prisma.Decimal(0);
        let debitsSum = new Prisma.Decimal(0);
        let withdrawalDebitsSum = new Prisma.Decimal(0);

        if (ids.length > 0) {
          const [cAgg, dAgg, wAgg] = await Promise.all([
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: ids },
                status: 'COMPLETED',
                type: 'CREDIT',
              },
              _sum: { amount: true },
            }),
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: ids },
                status: 'COMPLETED',
                type: 'DEBIT',
              },
              _sum: { amount: true },
            }),
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: ids },
                status: 'COMPLETED',
                type: 'DEBIT',
                source: 'WITHDRAWAL',
              },
              _sum: { amount: true },
            }),
          ]);
          creditsSum = cAgg._sum.amount ?? new Prisma.Decimal(0);
          debitsSum = dAgg._sum.amount ?? new Prisma.Decimal(0);
          withdrawalDebitsSum = wAgg._sum.amount ?? new Prisma.Decimal(0);
        }

        const netFromLedger = creditsSum.minus(debitsSum);
        const ledgerDelta = totalBalance.minus(netFromLedger);

        const [completedWdAgg, pendingWdAgg] = await Promise.all([
          this.prisma.walletWithdrawal.aggregate({
            where: {
              userId: { not: null },
              status: 'COMPLETED',
              currency,
            },
            _sum: { amount: true },
          }),
          this.prisma.walletWithdrawal.aggregate({
            where: {
              userId: { not: null },
              status: 'PENDING',
              currency,
            },
            _sum: { amount: true },
          }),
        ]);

        const completedUserWithdrawalsSum =
          completedWdAgg._sum.amount ?? new Prisma.Decimal(0);
        const pendingUserWithdrawalsTotal =
          pendingWdAgg._sum.amount ?? new Prisma.Decimal(0);

        const withdrawalDelta = completedUserWithdrawalsSum.minus(withdrawalDebitsSum);
        const otherDebitsSum = debitsSum.minus(withdrawalDebitsSum);

        let restaurantTotalBalance = new Prisma.Decimal(0);
        for (const id of restIds) {
          const bal = await this.repo.getBalance(this.prisma, id);
          restaurantTotalBalance = restaurantTotalBalance.plus(bal);
        }

        let restCreditsSum = new Prisma.Decimal(0);
        let restDebitsSum = new Prisma.Decimal(0);
        let restaurantWithdrawalDebitsSum = new Prisma.Decimal(0);
        if (restIds.length > 0) {
          const [rcAgg, rdAgg, rwAgg] = await Promise.all([
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: restIds },
                status: 'COMPLETED',
                type: 'CREDIT',
              },
              _sum: { amount: true },
            }),
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: restIds },
                status: 'COMPLETED',
                type: 'DEBIT',
              },
              _sum: { amount: true },
            }),
            this.prisma.walletLedgerEntry.aggregate({
              where: {
                walletId: { in: restIds },
                status: 'COMPLETED',
                type: 'DEBIT',
                source: 'WITHDRAWAL',
              },
              _sum: { amount: true },
            }),
          ]);
          restCreditsSum = rcAgg._sum.amount ?? new Prisma.Decimal(0);
          restDebitsSum = rdAgg._sum.amount ?? new Prisma.Decimal(0);
          restaurantWithdrawalDebitsSum = rwAgg._sum.amount ?? new Prisma.Decimal(0);
        }

        const restOtherDebitsSum = restDebitsSum.minus(restaurantWithdrawalDebitsSum);
        const restNetFromLedger = restCreditsSum.minus(restDebitsSum);
        const restLedgerDelta = restaurantTotalBalance.minus(restNetFromLedger);

        const [completedRestWdAgg, pendingRestWdAgg] = await Promise.all([
          this.prisma.walletWithdrawal.aggregate({
            where: {
              restaurantId: { not: null },
              status: 'COMPLETED',
              currency,
            },
            _sum: { amount: true },
          }),
          this.prisma.walletWithdrawal.aggregate({
            where: {
              restaurantId: { not: null },
              status: 'PENDING',
              currency,
            },
            _sum: { amount: true },
          }),
        ]);

        const completedRestaurantWithdrawalsSum =
          completedRestWdAgg._sum.amount ?? new Prisma.Decimal(0);
        const pendingRestaurantWithdrawalsTotal =
          pendingRestWdAgg._sum.amount ?? new Prisma.Decimal(0);
        const restaurantWithdrawalDelta =
          completedRestaurantWithdrawalsSum.minus(restaurantWithdrawalDebitsSum);

        return {
          currency,
          walletCount: ids.length,
          restaurantWalletCount: restIds.length,
          /** Sum of per-wallet balances (COMPLETED credits − debits); funds still in user wallets. */
          totalBalance: formatWalletAmountForApi(totalBalance),
          totalCredits: formatWalletAmountForApi(creditsSum),
          totalDebits: formatWalletAmountForApi(debitsSum),
          otherDebitsFromLedgerSum: formatWalletAmountForApi(otherDebitsSum),
          netFromLedger: formatWalletAmountForApi(netFromLedger),
          ledgerReconciliationDelta: formatWalletAmountForApi(ledgerDelta),
          ledgerReconciliationOk: this.isNearZero(ledgerDelta),
          completedUserWithdrawalsSum: formatWalletAmountForApi(completedUserWithdrawalsSum),
          userWithdrawalDebitsFromLedgerSum: formatWalletAmountForApi(withdrawalDebitsSum),
          withdrawalReconciliationDelta: formatWalletAmountForApi(withdrawalDelta),
          withdrawalReconciliationOk: this.isNearZero(withdrawalDelta),
          pendingUserWithdrawalsTotal: formatWalletAmountForApi(pendingUserWithdrawalsTotal),
          completedRestaurantWithdrawalsSum: formatWalletAmountForApi(
            completedRestaurantWithdrawalsSum,
          ),
          restaurantWithdrawalDebitsFromLedgerSum: formatWalletAmountForApi(
            restaurantWithdrawalDebitsSum,
          ),
          restaurantWithdrawalReconciliationDelta: formatWalletAmountForApi(
            restaurantWithdrawalDelta,
          ),
          restaurantWithdrawalReconciliationOk: this.isNearZero(restaurantWithdrawalDelta),
          pendingRestaurantWithdrawalsTotal: formatWalletAmountForApi(
            pendingRestaurantWithdrawalsTotal,
          ),
          restaurantTotalBalance: formatWalletAmountForApi(restaurantTotalBalance),
          restaurantTotalCredits: formatWalletAmountForApi(restCreditsSum),
          restaurantTotalDebits: formatWalletAmountForApi(restDebitsSum),
          restaurantOtherDebitsFromLedgerSum: formatWalletAmountForApi(restOtherDebitsSum),
          restaurantNetFromLedger: formatWalletAmountForApi(restNetFromLedger),
          restaurantLedgerReconciliationDelta: formatWalletAmountForApi(restLedgerDelta),
          restaurantLedgerReconciliationOk: this.isNearZero(restLedgerDelta),
        };
      }),
    );

    return { byCurrency };
  }
}

const prismaSingleton = new PrismaClient();
const repoSingleton = new WalletRepository(prismaSingleton);
const auditSingleton = new AuditService(prismaSingleton);

export const walletService = new WalletService(prismaSingleton, repoSingleton, auditSingleton);
