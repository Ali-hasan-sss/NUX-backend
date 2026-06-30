import type Stripe from 'stripe';
import { getStripeClient } from '../lib/stripeClient';

export type RefundableStripePayment = {
  stripeInvoiceId: string;
  paymentIntentId?: string;
  chargeId?: string;
  amountPaid: number;
  currency: string;
  created: number;
  recordedLocally: boolean;
  alreadyRefunded: boolean;
};

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | undefined {
  const pi = (invoice as { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent;
  if (!pi) return undefined;
  return typeof pi === 'string' ? pi : pi.id;
}

function invoiceChargeId(invoice: Stripe.Invoice): string | undefined {
  const ch = (invoice as { charge?: string | Stripe.Charge | null }).charge;
  if (!ch) return undefined;
  return typeof ch === 'string' ? ch : ch.id;
}

function invoicePaymentFromPayments(invoice: Stripe.Invoice): {
  paymentIntentId?: string;
  chargeId?: string;
} {
  const inv = invoice as unknown as {
    payments?: { data?: Array<{ payment?: { payment_intent?: unknown; charge?: unknown } }> };
  };
  const payments = inv.payments?.data;
  if (!payments?.length) return {};

  const payment = payments[0]?.payment;
  if (!payment) return {};

  const pi = payment.payment_intent;
  const ch = payment.charge;

  const result: { paymentIntentId?: string; chargeId?: string } = {};
  if (typeof pi === 'string') result.paymentIntentId = pi;
  else if (pi && typeof pi === 'object' && 'id' in pi) result.paymentIntentId = String((pi as { id: string }).id);

  if (typeof ch === 'string') result.chargeId = ch;
  else if (ch && typeof ch === 'object' && 'id' in ch) result.chargeId = String((ch as { id: string }).id);

  return result;
}

async function chargeIsFullyRefunded(chargeId: string): Promise<boolean> {
  const stripe = getStripeClient();
  const charge = await stripe.charges.retrieve(chargeId);
  return charge.refunded === true;
}

async function paymentIntentIsFullyRefunded(paymentIntentId: string): Promise<boolean> {
  const stripe = getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status === 'canceled') return true;
  const received = pi.amount_received ?? pi.amount;
  const refunded = (pi as { amount_refunded?: number }).amount_refunded ?? 0;
  return received > 0 && refunded >= received;
}

export async function resolveInvoicePaymentRef(
  invoiceId: string,
): Promise<Pick<RefundableStripePayment, 'paymentIntentId' | 'chargeId' | 'alreadyRefunded'>> {
  const stripe = getStripeClient();
  const invoice = await stripe.invoices.retrieve(invoiceId, {
    expand: ['payments.data.payment.payment_intent', 'payments.data.payment.charge', 'charge'],
  });

  let paymentIntentId = invoicePaymentIntentId(invoice);
  let chargeId = invoiceChargeId(invoice);

  if (!paymentIntentId && !chargeId) {
    const fromPayments = invoicePaymentFromPayments(invoice);
    paymentIntentId = fromPayments.paymentIntentId;
    chargeId = fromPayments.chargeId;
  }

  if (!paymentIntentId && chargeId) {
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.payment_intent) {
      paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent.id;
    }
    if (charge.refunded) {
      return {
        ...(paymentIntentId ? { paymentIntentId } : {}),
        chargeId,
        alreadyRefunded: true,
      };
    }
  }

  if (paymentIntentId && (await paymentIntentIsFullyRefunded(paymentIntentId))) {
    return {
      paymentIntentId,
      ...(chargeId ? { chargeId } : {}),
      alreadyRefunded: true,
    };
  }
  if (chargeId && (await chargeIsFullyRefunded(chargeId))) {
    return {
      ...(paymentIntentId ? { paymentIntentId } : {}),
      chargeId,
      alreadyRefunded: true,
    };
  }

  return {
    ...(paymentIntentId ? { paymentIntentId } : {}),
    ...(chargeId ? { chargeId } : {}),
    alreadyRefunded: false,
  };
}

export async function listRefundableStripeInvoices(params: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  knownLocalInvoiceIds: string[];
}): Promise<RefundableStripePayment[]> {
  const stripe = getStripeClient();
  const results: RefundableStripePayment[] = [];

  const lists: Stripe.Invoice[] = [];

  if (params.stripeSubscriptionId) {
    const subInvoices = await stripe.invoices.list({
      subscription: params.stripeSubscriptionId,
      status: 'paid',
      limit: 24,
    });
    lists.push(...subInvoices.data);
  }

  if (params.stripeCustomerId) {
    const customerInvoices = await stripe.invoices.list({
      customer: params.stripeCustomerId,
      status: 'paid',
      limit: 24,
    });
    for (const inv of customerInvoices.data) {
      if (!lists.some((x) => x.id === inv.id)) lists.push(inv);
    }
  }

  lists.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  for (const inv of lists) {
    if (!inv.id) continue;
    const refs = await resolveInvoicePaymentRef(inv.id);
    if (!refs.paymentIntentId && !refs.chargeId) continue;

    results.push({
      stripeInvoiceId: inv.id,
      ...(refs.paymentIntentId ? { paymentIntentId: refs.paymentIntentId } : {}),
      ...(refs.chargeId ? { chargeId: refs.chargeId } : {}),
      amountPaid: (inv.amount_paid ?? 0) / 100,
      currency: (inv.currency || 'eur').toUpperCase(),
      created: inv.created ?? 0,
      recordedLocally: params.knownLocalInvoiceIds.includes(inv.id),
      alreadyRefunded: refs.alreadyRefunded,
    });
  }

  return results;
}

/**
 * Pick invoice to refund.
 * Default: newest paid Stripe invoice that is NOT recorded locally (duplicate auto-charge),
 * else newest refundable invoice.
 */
export function pickRefundTarget(
  candidates: RefundableStripePayment[],
  options?: { stripeInvoiceId?: string; preferUnrecorded?: boolean },
): RefundableStripePayment | null {
  const refundable = candidates.filter((c) => !c.alreadyRefunded);
  if (!refundable.length) return null;

  if (options?.stripeInvoiceId) {
    return refundable.find((c) => c.stripeInvoiceId === options.stripeInvoiceId) ?? null;
  }

  if (options?.preferUnrecorded !== false) {
    const unrecorded = refundable.find((c) => !c.recordedLocally);
    if (unrecorded) return unrecorded;
  }

  return refundable[0] ?? null;
}

export async function createStripeRefund(params: {
  paymentIntentId?: string;
  chargeId?: string;
  amountCents?: number;
  metadata: Record<string, string>;
}): Promise<Stripe.Refund> {
  const stripe = getStripeClient();
  const base = {
    reason: 'requested_by_customer' as const,
    metadata: params.metadata,
    ...(params.amountCents != null && params.amountCents > 0
      ? { amount: params.amountCents }
      : {}),
  };

  if (params.paymentIntentId) {
    return stripe.refunds.create({ payment_intent: params.paymentIntentId, ...base });
  }
  if (params.chargeId) {
    return stripe.refunds.create({ charge: params.chargeId, ...base });
  }
  throw new Error('No payment intent or charge available for refund');
}
