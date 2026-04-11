import {
  Prisma,
  PrismaClient,
  Wallet,
  WalletLedgerEntry,
  WalletLedgerSource,
  WalletLedgerStatus,
  WalletOwnerType,
} from '@prisma/client';

export class WalletRepository {
  constructor(private readonly db: PrismaClient) {}

  async getBalance(
    tx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<Prisma.Decimal> {
    const [credit, debit] = await Promise.all([
      tx.walletLedgerEntry.aggregate({
        where: { walletId, status: 'COMPLETED', type: 'CREDIT' },
        _sum: { amount: true },
      }),
      tx.walletLedgerEntry.aggregate({
        where: { walletId, status: 'COMPLETED', type: 'DEBIT' },
        _sum: { amount: true },
      }),
    ]);
    const c = credit._sum.amount ?? new Prisma.Decimal(0);
    const d = debit._sum.amount ?? new Prisma.Decimal(0);
    return c.minus(d);
  }

  async getBalanceByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<{ balance: Prisma.Decimal; walletId: string; currency: string } | null> {
    const wallet = await this.db.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
    if (!wallet) {
      return null;
    }
    const balance = await this.getBalance(this.db, wallet.id);
    return { balance, walletId: wallet.id, currency: wallet.currency };
  }

  async getOrCreateWallet(
    tx: Prisma.TransactionClient,
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = 'EUR',
  ): Promise<Wallet> {
    const existing = await tx.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
    if (existing) return existing;
    return tx.wallet.create({
      data: { ownerType, ownerId, currency },
    });
  }

  async findLedgerByIdempotencyKey(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<WalletLedgerEntry | null> {
    const row = await tx.walletLedgerEntry.findUnique({
      where: { idempotencyKey: key },
    });
    return row;
  }

  async createLedgerEntry(
    tx: Prisma.TransactionClient,
    data: {
      walletId: string;
      type: 'CREDIT' | 'DEBIT';
      amount: Prisma.Decimal;
      status: WalletLedgerStatus;
      source: WalletLedgerSource;
      referenceId?: string | null;
      metadata?: Prisma.InputJsonValue;
      idempotencyKey?: string | null;
    },
  ): Promise<WalletLedgerEntry> {
    return tx.walletLedgerEntry.create({
      data: {
        walletId: data.walletId,
        type: data.type,
        amount: data.amount,
        status: data.status,
        source: data.source,
        ...(data.referenceId != null ? { referenceId: data.referenceId } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        ...(data.idempotencyKey != null && data.idempotencyKey !== ''
          ? { idempotencyKey: data.idempotencyKey }
          : {}),
      },
    });
  }

  async listLedgerForWallet(
    walletId: string,
    take: number,
    cursor?: string,
  ): Promise<WalletLedgerEntry[]> {
    return this.db.walletLedgerEntry.findMany({
      where: { walletId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(take, 100),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  /** Completed ledger rows only (same basis as balance). */
  private completedRangeWhere(
    walletId: string,
    range?: { start?: Date; end?: Date },
  ): Prisma.WalletLedgerEntryWhereInput {
    const where: Prisma.WalletLedgerEntryWhereInput = {
      walletId,
      status: 'COMPLETED',
    };
    if (range?.start || range?.end) {
      where.createdAt = {};
      if (range.start) where.createdAt.gte = range.start;
      if (range.end) where.createdAt.lte = range.end;
    }
    return where;
  }

  async countLedgerCompleted(
    walletId: string,
    range?: { start?: Date; end?: Date },
  ): Promise<number> {
    return this.db.walletLedgerEntry.count({
      where: this.completedRangeWhere(walletId, range),
    });
  }

  async listLedgerCompletedPage(
    walletId: string,
    params: { skip: number; take: number; start?: Date; end?: Date },
  ): Promise<WalletLedgerEntry[]> {
    const range: { start?: Date; end?: Date } | undefined =
      params.start !== undefined || params.end !== undefined
        ? {
            ...(params.start !== undefined ? { start: params.start } : {}),
            ...(params.end !== undefined ? { end: params.end } : {}),
          }
        : undefined;
    return this.db.walletLedgerEntry.findMany({
      where: this.completedRangeWhere(walletId, range),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: params.skip,
      take: Math.min(params.take, 100),
    });
  }

  async sumLedgerCompletedByType(
    walletId: string,
    type: 'CREDIT' | 'DEBIT',
    range?: { start?: Date; end?: Date },
  ): Promise<Prisma.Decimal> {
    const base = this.completedRangeWhere(walletId, range);
    const row = await this.db.walletLedgerEntry.aggregate({
      where: { ...base, type },
      _sum: { amount: true },
    });
    return row._sum.amount ?? new Prisma.Decimal(0);
  }

  async countLedgerCompletedSince(
    walletId: string,
    since: Date,
    until?: Date,
  ): Promise<number> {
    const where: Prisma.WalletLedgerEntryWhereInput = {
      walletId,
      status: 'COMPLETED',
      createdAt: until != null ? { gte: since, lte: until } : { gte: since },
    };
    return this.db.walletLedgerEntry.count({ where });
  }
}
