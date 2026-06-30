import type StripeNS from 'stripe';
import { PrismaClient } from '@prisma/client';
import { getStripeClient } from '../lib/stripeClient';

const prisma = new PrismaClient();

const STATEMENT_BASE = (process.env.STRIPE_STATEMENT_DESCRIPTOR || 'NUX APP').slice(0, 22);

export function stripeStatementDescriptor(): string {
  return STATEMENT_BASE;
}

export function stripeSubscriptionDescription(planTitle: string): string {
  return `NUX subscription — ${planTitle}`;
}

export function extractStripePeriod(sub: StripeNS.Subscription): {
  stripeCurrentPeriodStart?: Date;
  stripeCurrentPeriodEnd?: Date;
} {
  const periodStart = (sub as { current_period_start?: number }).current_period_start;
  const periodEnd = (sub as { current_period_end?: number }).current_period_end;
  const result: {
    stripeCurrentPeriodStart?: Date;
    stripeCurrentPeriodEnd?: Date;
  } = {};

  if (periodStart && typeof periodStart === 'number') {
    const d = new Date(periodStart * 1000);
    if (!isNaN(d.getTime())) result.stripeCurrentPeriodStart = d;
  }
  if (periodEnd && typeof periodEnd === 'number') {
    const d = new Date(periodEnd * 1000);
    if (!isNaN(d.getTime())) result.stripeCurrentPeriodEnd = d;
  }
  return result;
}

/** Map Stripe subscription → local DB fields (Stripe period is source of truth for endDate). */
export function syncFieldsFromStripeSub(sub: StripeNS.Subscription) {
  const periods = extractStripePeriod(sub);
  const autoRenew = !sub.cancel_at_period_end;
  return {
    stripeSubscriptionId: sub.id,
    stripeStatus: sub.status,
    autoRenew,
    ...periods,
    endDate: periods.stripeCurrentPeriodEnd,
  };
}

export async function retrieveStripeSubscription(
  subscriptionId: string,
): Promise<StripeNS.Subscription> {
  return getStripeClient().subscriptions.retrieve(subscriptionId) as Promise<StripeNS.Subscription>;
}

/** Cancel Stripe billing at period end (keeps access until current period ends). */
export async function setStripeAutoRenew(
  stripeSubscriptionId: string,
  enabled: boolean,
): Promise<StripeNS.Subscription> {
  const stripe = getStripeClient();
  if (enabled) {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    }) as Promise<StripeNS.Subscription>;
  }
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  }) as Promise<StripeNS.Subscription>;
}

/** Immediately stop Stripe recurring billing (prevents double charge on manual re-subscribe). */
export async function cancelStripeSubscriptionImmediately(
  stripeSubscriptionId: string,
): Promise<void> {
  try {
    await getStripeClient().subscriptions.cancel(stripeSubscriptionId);
  } catch (error) {
    if (!isStripeMissing(error)) throw error;
  }
}

function isStripeMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; statusCode?: number; message?: string };
  return (
    e.code === 'resource_missing' ||
    e.statusCode === 404 ||
    e.message?.toLowerCase().includes('no such') === true
  );
}

/** Cancel any active Stripe subscription for a restaurant before starting a new checkout. */
export async function cancelExistingStripeSubscriptionsForRestaurant(
  restaurantId: string,
  excludeSubscriptionId?: number,
): Promise<void> {
  const rows = await prisma.subscription.findMany({
      where: {
        restaurantId,
        stripeSubscriptionId: { not: null },
        status: { in: ['ACTIVE', 'PENDING'] },
        ...(excludeSubscriptionId ? { id: { not: excludeSubscriptionId } } : {}),
      },
      select: { id: true, stripeSubscriptionId: true },
    });

    for (const row of rows) {
      if (row.stripeSubscriptionId) {
        await cancelStripeSubscriptionImmediately(row.stripeSubscriptionId);
      }
      await prisma.subscription.update({
        where: { id: row.id },
        data: { autoRenew: false, stripeStatus: 'canceled' },
      });
    }
}

export function checkoutSubscriptionData(planTitle: string, metadata: Record<string, string>) {
  return {
    description: stripeSubscriptionDescription(planTitle),
    metadata,
  };
}
