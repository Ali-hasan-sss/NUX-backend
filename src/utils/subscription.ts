import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FREE_TRIAL_TITLE = 'free trial';

function isFreeTrialPlan(title: string, price: number): boolean {
  return price === 0 || title.trim().toLowerCase() === FREE_TRIAL_TITLE;
}

/**
 * Cancel other active subscriptions when a new one is activated.
 * Ensures permission checks use a single plan (no mixed features from old plans).
 */
export async function supersedeOtherActiveSubscriptions(
  restaurantId: string,
  keepSubscriptionId: number,
): Promise<number> {
  const result = await prisma.subscription.updateMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      endDate: { gte: new Date() },
      id: { not: keepSubscriptionId },
    },
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

/**
 * Close all table sessions when the effective plan no longer supports orders.
 */
export async function closeTableSessionsIfOrdersNotAllowed(
  restaurantId: string,
): Promise<void> {
  const subscription = await getEffectiveActiveSubscription(restaurantId);
  const permissions = subscription?.plan?.permissions ?? [];
  const hasOrders = permissions.some((p) => String(p.type) === 'MANAGE_ORDERS');
  if (!hasOrders) {
    await prisma.table.updateMany({
      where: { restaurantId },
      data: { isSessionOpen: false },
    });
  }
}

/**
 * After activating a subscription: keep only this one active and sync table sessions.
 */
export async function finalizeSubscriptionActivation(
  restaurantId: string,
  keepSubscriptionId: number,
): Promise<void> {
  await supersedeOtherActiveSubscriptions(restaurantId, keepSubscriptionId);
  await closeTableSessionsIfOrdersNotAllowed(restaurantId);
}

/**
 * Resolve the single subscription that drives plan permissions.
 * Uses the most recently created active subscription (last activation / plan change wins).
 */
export async function getEffectiveActiveSubscription(restaurantId: string) {
  const now = new Date();

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      endDate: { gte: now },
      startDate: { lte: now },
    },
    include: {
      plan: { include: { permissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeSubscriptions.length === 0) return null;

  // Prefer the newest paid plan over an older Free Trial still within its window.
  const sorted = [...activeSubscriptions].sort((a, b) => {
    const aFree = isFreeTrialPlan(a.plan.title, a.plan.price);
    const bFree = isFreeTrialPlan(b.plan.title, b.plan.price);
    if (aFree !== bFree) return aFree ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted[0];
}
