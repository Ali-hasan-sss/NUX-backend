import { Prisma, PrismaClient, scanType } from '@prisma/client';
import { emitToRestaurant, emitToUser } from './socket.service';
import { sendNotificationToUser } from './notification.service';

const prisma = new PrismaClient();

export const LOYALTY_SCAN_TTL_MS = 120_000;

export class LoyaltyScanApprovalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'LoyaltyScanApprovalError';
  }
}

export type LoyaltyScanApprovalPayload = {
  id: string;
  status: string;
  type: scanType;
  restaurantId: string;
  restaurantName: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
  };
  createdAt: string;
  expiresAt: string;
};

function toPayload(row: {
  id: string;
  status: string;
  type: scanType;
  restaurantId: string;
  createdAt: Date;
  expiresAt: Date;
  restaurant: { name: string };
  user: { id: string; fullName: string | null; email: string };
}): LoyaltyScanApprovalPayload {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurant.name,
    user: {
      id: row.user.id,
      fullName: row.user.fullName,
      email: row.user.email,
    },
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

const approvalInclude = {
  restaurant: { select: { name: true } },
  user: { select: { id: true, fullName: true, email: true } },
} as const;

async function expireOverdue(
  where: Prisma.LoyaltyScanApprovalWhereInput = {},
): Promise<Array<{ id: string; userId: string; restaurantId: string; type: scanType; restaurantName: string }>> {
  const overdue = await prisma.loyaltyScanApproval.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
      ...where,
    },
    select: {
      id: true,
      userId: true,
      restaurantId: true,
      type: true,
      restaurant: { select: { name: true } },
    },
  });

  if (overdue.length === 0) return [];

  await prisma.loyaltyScanApproval.updateMany({
    where: { id: { in: overdue.map((row) => row.id) } },
    data: { status: 'EXPIRED', resolvedAt: new Date() },
  });

  return overdue.map((row) => ({
    id: row.id,
    userId: row.userId,
    restaurantId: row.restaurantId,
    type: row.type,
    restaurantName: row.restaurant.name,
  }));
}

function notifyExpired(
  rows: Array<{ id: string; userId: string; restaurantId: string; type: scanType; restaurantName: string }>,
) {
  for (const row of rows) {
    const payload = { id: row.id, status: 'EXPIRED' as const, type: row.type, restaurantName: row.restaurantName };
    emitToRestaurant(row.restaurantId, 'loyalty:scan-resolved', payload);
    emitToUser(row.userId, 'loyalty:scan-resolved', payload);
  }
}

async function awardLoyaltyStars(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    restaurantId: string;
    type: scanType;
    qrCode: string;
    latitude: number;
    longitude: number;
  },
): Promise<void> {
  const isMeal = params.type === 'meal';

  await tx.userRestaurantBalance.upsert({
    where: {
      userId_restaurantId: {
        userId: params.userId,
        restaurantId: params.restaurantId,
      },
    },
    create: {
      userId: params.userId,
      restaurantId: params.restaurantId,
      stars_meal: isMeal ? 1 : 0,
      stars_drink: isMeal ? 0 : 1,
      balance: 0,
    },
    update: isMeal
      ? { stars_meal: { increment: 1 } }
      : { stars_drink: { increment: 1 } },
  });

  await tx.scanLog.create({
    data: {
      userId: params.userId,
      restaurantId: params.restaurantId,
      type: params.type,
      qrCode: params.qrCode,
      latitude: params.latitude,
      longitude: params.longitude,
    },
  });

  await tx.starsTransaction.create({
    data: {
      userId: params.userId,
      restaurantId: params.restaurantId,
      type: params.type,
      stars_meal: isMeal ? 1 : 0,
      stars_drink: isMeal ? 0 : 1,
    },
  });
}

export async function createLoyaltyScanRequest(params: {
  userId: string;
  restaurantId: string;
  restaurantOwnerId: string;
  type: scanType;
  qrCode: string;
  latitude: number;
  longitude: number;
}): Promise<LoyaltyScanApprovalPayload> {
  notifyExpired(
    await expireOverdue({ userId: params.userId, restaurantId: params.restaurantId }),
  );

  const existing = await prisma.loyaltyScanApproval.findFirst({
    where: {
      userId: params.userId,
      restaurantId: params.restaurantId,
      type: params.type,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: approvalInclude,
  });

  if (existing) {
    return toPayload(existing);
  }

  const created = await prisma.loyaltyScanApproval.create({
    data: {
      userId: params.userId,
      restaurantId: params.restaurantId,
      type: params.type,
      qrCode: params.qrCode,
      latitude: params.latitude,
      longitude: params.longitude,
      expiresAt: new Date(Date.now() + LOYALTY_SCAN_TTL_MS),
    },
    include: approvalInclude,
  });

  const payload = toPayload(created);
  const customerName = payload.user.fullName || payload.user.email;
  const kind = payload.type === 'meal' ? 'meal' : 'drink';

  emitToRestaurant(params.restaurantId, 'loyalty:scan-request', payload);

  await sendNotificationToUser({
    userId: params.restaurantOwnerId,
    title: 'Loyalty scan approval needed',
    body: `${customerName} requested ${kind} points. Approve to award.`,
    type: 'LOYALTY_SCAN',
    data: { approvalId: payload.id, scanType: payload.type },
  });

  return payload;
}

export async function getCustomerScanApproval(
  userId: string,
  approvalId: string,
): Promise<LoyaltyScanApprovalPayload> {
  notifyExpired(await expireOverdue({ id: approvalId, userId }));

  const row = await prisma.loyaltyScanApproval.findFirst({
    where: { id: approvalId, userId },
    include: approvalInclude,
  });

  if (!row) {
    throw new LoyaltyScanApprovalError('Scan request not found', 'NOT_FOUND', 404);
  }

  return toPayload(row);
}

export async function listPendingForRestaurant(
  restaurantId: string,
): Promise<LoyaltyScanApprovalPayload[]> {
  notifyExpired(await expireOverdue({ restaurantId }));

  const rows = await prisma.loyaltyScanApproval.findMany({
    where: {
      restaurantId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: approvalInclude,
    orderBy: { createdAt: 'asc' },
  });

  return rows.map(toPayload);
}

async function resolvePending(params: {
  approvalId: string;
  restaurantId: string;
  action: 'APPROVED' | 'REJECTED';
}) {
  notifyExpired(await expireOverdue({ id: params.approvalId, restaurantId: params.restaurantId }));

  const row = await prisma.loyaltyScanApproval.findFirst({
    where: { id: params.approvalId, restaurantId: params.restaurantId },
    include: {
      ...approvalInclude,
      restaurant: { select: { name: true, userId: true } },
    },
  });

  if (!row) {
    throw new LoyaltyScanApprovalError('Scan request not found', 'NOT_FOUND', 404);
  }
  if (row.status === 'EXPIRED') {
    throw new LoyaltyScanApprovalError('Scan request expired', 'EXPIRED', 410);
  }
  if (row.status !== 'PENDING') {
    throw new LoyaltyScanApprovalError('Scan request already resolved', 'ALREADY_RESOLVED', 409);
  }
  if (row.expiresAt <= new Date()) {
    await prisma.loyaltyScanApproval.update({
      where: { id: row.id },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    throw new LoyaltyScanApprovalError('Scan request expired', 'EXPIRED', 410);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.loyaltyScanApproval.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: params.action, resolvedAt: new Date() },
    });
    if (locked.count !== 1) {
      throw new LoyaltyScanApprovalError('Scan request already resolved', 'ALREADY_RESOLVED', 409);
    }
    if (params.action === 'APPROVED') {
      await awardLoyaltyStars(tx, {
        userId: row.userId,
        restaurantId: row.restaurantId,
        type: row.type,
        qrCode: row.qrCode,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
    return locked;
  }).catch((error) => {
    if (error instanceof LoyaltyScanApprovalError) throw error;
    const cause = (error as { cause?: unknown })?.cause;
    if (cause instanceof LoyaltyScanApprovalError) throw cause;
    throw error;
  });

  if (updated.count !== 1) {
    throw new LoyaltyScanApprovalError('Scan request already resolved', 'ALREADY_RESOLVED', 409);
  }

  const resolvedPayload = {
    id: row.id,
    status: params.action,
    type: row.type,
    restaurantName: row.restaurant.name,
    restaurantId: row.restaurantId,
  };

  emitToRestaurant(row.restaurantId, 'loyalty:scan-resolved', resolvedPayload);
  emitToUser(row.userId, 'loyalty:scan-resolved', resolvedPayload);

  if (params.action === 'APPROVED') {
    const isMeal = row.type === 'meal';
    await sendNotificationToUser({
      userId: row.userId,
      title: 'You received a stars!',
      body: `You received ${isMeal ? 1 : 0}  stars meal & ${isMeal ? 0 : 1} stars drink from ${row.restaurant.name}`,
      type: 'STARS',
    });
  } else {
    await sendNotificationToUser({
      userId: row.userId,
      title: 'Loyalty scan declined',
      body: `The cashier did not approve your ${row.type} scan at ${row.restaurant.name}. Points were not added.`,
      type: 'LOYALTY_SCAN',
    });
  }

  return resolvedPayload;
}

export async function approveLoyaltyScan(approvalId: string, restaurantId: string) {
  return resolvePending({ approvalId, restaurantId, action: 'APPROVED' });
}

export async function rejectLoyaltyScan(approvalId: string, restaurantId: string) {
  return resolvePending({ approvalId, restaurantId, action: 'REJECTED' });
}
