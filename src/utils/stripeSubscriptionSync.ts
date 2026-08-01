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

function toDateFromUnix(seconds?: number | null): Date | undefined {
  if (!seconds || typeof seconds !== 'number') return undefined;
  const d = new Date(seconds * 1000);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Stripe Basil+ removed top-level current_period_* from Subscription;
 * periods live on subscription items. Keep reading legacy fields as fallback.
 */
export function extractStripePeriod(sub: StripeNS.Subscription): {
  stripeCurrentPeriodStart?: Date;
  stripeCurrentPeriodEnd?: Date;
} {
  const legacy = sub as {
    current_period_start?: number;
    current_period_end?: number;
  };

  let periodStartSec: number | undefined = legacy.current_period_start;
  let periodEndSec: number | undefined = legacy.current_period_end;

  const items = sub.items?.data ?? [];
  for (const item of items) {
    const itemPeriod = item as {
      current_period_start?: number;
      current_period_end?: number;
    };
    if (
      typeof itemPeriod.current_period_start === 'number' &&
      (periodStartSec === undefined || itemPeriod.current_period_start < periodStartSec)
    ) {
      periodStartSec = itemPeriod.current_period_start;
    }
    // Earliest item end matches Stripe's mixed-interval subscription period
    if (
      typeof itemPeriod.current_period_end === 'number' &&
      (periodEndSec === undefined || itemPeriod.current_period_end < periodEndSec)
    ) {
      periodEndSec = itemPeriod.current_period_end;
    }
  }

  const result: {
    stripeCurrentPeriodStart?: Date;
    stripeCurrentPeriodEnd?: Date;
  } = {};

  const start = toDateFromUnix(periodStartSec);
  const end = toDateFromUnix(periodEndSec);
  if (start) result.stripeCurrentPeriodStart = start;
  if (end) result.stripeCurrentPeriodEnd = end;
  return result;
}

/** Fallback when subscription object has no period (use paid invoice line period). */
export function extractPeriodFromInvoice(inv: StripeNS.Invoice): {
  stripeCurrentPeriodStart?: Date;
  stripeCurrentPeriodEnd?: Date;
} {
  const lines = inv.lines?.data ?? [];
  const lineWithPeriod = lines.find((l) => l.period?.end) ?? lines[0];
  const invAny = inv as { period_start?: number; period_end?: number };

  const startSec = lineWithPeriod?.period?.start ?? invAny.period_start;
  const endSec = lineWithPeriod?.period?.end ?? invAny.period_end;

  const result: {
    stripeCurrentPeriodStart?: Date;
    stripeCurrentPeriodEnd?: Date;
  } = {};
  const start = toDateFromUnix(startSec);
  const end = toDateFromUnix(endSec);
  if (start) result.stripeCurrentPeriodStart = start;
  if (end) result.stripeCurrentPeriodEnd = end;
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

/**
 * Cancel Stripe subscriptions linked to local rows that are still billable remotely.
 * Includes EXPIRED/CANCELLED so a wrongly-expired local row cannot keep billing in Stripe
 * while the restaurant starts a new checkout.
 */
export async function cancelExistingStripeSubscriptionsForRestaurant(
  restaurantId: string,
  excludeSubscriptionId?: number,
): Promise<void> {
  const rows = await prisma.subscription.findMany({
    where: {
      restaurantId,
      stripeSubscriptionId: { not: null },
      status: { in: ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'] },
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

/** Stop Stripe billing for EXPIRED/CANCELLED local rows whose Stripe status is no longer active. */
export async function cancelStaleStripeSubscriptionsForRestaurant(
  restaurantId: string,
): Promise<void> {
  const rows = await prisma.subscription.findMany({
    where: {
      restaurantId,
      stripeSubscriptionId: { not: null },
      status: { in: ['EXPIRED', 'CANCELLED'] },
      OR: [
        { stripeStatus: null },
        { stripeStatus: { notIn: ['active', 'trialing', 'past_due'] } },
      ],
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
