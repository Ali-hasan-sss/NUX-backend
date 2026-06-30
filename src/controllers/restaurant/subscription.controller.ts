import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { assertOwnerOrAdmin } from '../../utils/check_restauran-owner';
import type StripeNS from 'stripe';
import {
  createPayPalOrder,
  capturePayPalOrder,
  isPayPalConfigured,
} from '../../lib/paypal';
import { getStripeClient } from '../../lib/stripeClient';
import { walletService } from '../../wallet/services/wallet.service';
import { finalizeSubscriptionActivation } from '../../utils/subscription';
import {
  cancelExistingStripeSubscriptionsForRestaurant,
  checkoutSubscriptionData,
  retrieveStripeSubscription,
  stripeStatementDescriptor,
  syncFieldsFromStripeSub,
  setStripeAutoRenew,
} from '../../utils/stripeSubscriptionSync';

/**
 * @swagger
 * tags:
 *   - name: Subscription
 *     description: Restaurant subscription checkout and activation via Stripe or PayPal
 */
const prisma = new PrismaClient();

function getStripe() {
  return getStripeClient();
}
const stripe = getStripe();

function periodOrNow(value: unknown): Date {
  return value instanceof Date && !isNaN(value.getTime()) ? value : new Date();
}

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const stripeError = error as { code?: string; message?: string; statusCode?: number };
  return (
    stripeError.code === 'resource_missing' ||
    stripeError.statusCode === 404 ||
    stripeError.message?.toLowerCase().includes('no such') === true
  );
}

async function createStripeProductAndPriceForPlan(plan: {
  id: number;
  title: string;
  description: string | null;
  price: number;
  monthlyPrice: number | null;
  annualPrice: number | null;
  currency: string | null;
  duration: number;
}) {
  const monthlyPrice = plan.monthlyPrice ?? plan.price;
  const annualPrice = plan.annualPrice ?? monthlyPrice * 12;
  const product = await stripe.products.create({
    name: plan.title,
    statement_descriptor: stripeStatementDescriptor(),
    ...(plan.description && { description: plan.description }),
    metadata: {
      planId: String(plan.id),
      duration: String(plan.duration),
      type: 'subscription_plan',
    },
  });

  const monthlyStripePrice = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(monthlyPrice * 100),
    currency: (plan.currency || 'EUR').toLowerCase(),
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
    metadata: {
      planId: String(plan.id),
      plan_duration_days: String(plan.duration),
      billing_cycle: 'monthly',
    },
  });

  const annualStripePrice = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(annualPrice * 100),
    currency: (plan.currency || 'EUR').toLowerCase(),
    recurring: {
      interval: 'year',
      interval_count: 1,
    },
    metadata: {
      planId: String(plan.id),
      plan_duration_days: '365',
      billing_cycle: 'annual',
    },
  });

  await prisma.plan.update({
    where: { id: plan.id },
    data: {
      stripeProductId: product.id,
      stripePriceId: monthlyStripePrice.id,
      stripeMonthlyPriceId: monthlyStripePrice.id,
      stripeAnnualPriceId: annualStripePrice.id,
    },
  });

  return {
    monthlyPriceId: monthlyStripePrice.id,
    annualPriceId: annualStripePrice.id,
  };
}

async function ensureStripePriceForPlan(plan: {
  id: number;
  title: string;
  description: string | null;
  price: number;
  monthlyPrice: number | null;
  annualPrice: number | null;
  currency: string | null;
  duration: number;
  stripePriceId: string | null;
  stripeMonthlyPriceId: string | null;
  stripeAnnualPriceId: string | null;
}, billingCycle: 'monthly' | 'annual') {
  const wantedPriceId =
    billingCycle === 'annual'
      ? plan.stripeAnnualPriceId
      : plan.stripeMonthlyPriceId || plan.stripePriceId;

  if (!wantedPriceId) {
    const prices = await createStripeProductAndPriceForPlan(plan);
    return billingCycle === 'annual' ? prices.annualPriceId : prices.monthlyPriceId;
  }

  try {
    await stripe.prices.retrieve(wantedPriceId);
    return wantedPriceId;
  } catch (error) {
    if (!isMissingStripeResource(error)) throw error;

    // Seeded/test-mode plans can point to prices that do not exist in live mode.
    const prices = await createStripeProductAndPriceForPlan(plan);
    return billingCycle === 'annual' ? prices.annualPriceId : prices.monthlyPriceId;
  }
}

async function ensureStripeCustomerForRestaurant(restaurant: {
  id: string;
  stripeCustomerId: string | null;
}) {
  if (restaurant.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(restaurant.stripeCustomerId);
      return restaurant.stripeCustomerId;
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
    }
  }

  const customer = await stripe.customers.create({
    metadata: { restaurantId: restaurant.id },
  });

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * @swagger
 * /restaurants/subscription/checkout:
 *   post:
 *     summary: Create checkout session (Stripe or PayPal)
 *     description: |
 *       Creates a checkout session for a recurring subscription.
 *       - **provider=stripe** (default) Creates a Stripe Checkout Session using the plan's Stripe price.
 *       - **provider=paypal** Creates a PayPal order and returns the approval URL; after payment the client must call POST /restaurants/subscription/confirm-paypal with the orderId (token from return URL).
 *       Requires authentication as the restaurant owner.
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: integer
 *                 example: 1
 *               provider:
 *                 type: string
 *                 enum: [stripe, paypal]
 *                 default: stripe
 *                 description: Payment provider - stripe or paypal
 *               successUrl:
 *                 type: string
 *                 nullable: true
 *                 example: "https://app.example.com/dashboard/subscription?status=success"
 *               cancelUrl:
 *                 type: string
 *                 nullable: true
 *                 example: "https://app.example.com/dashboard/subscription?status=cancel"
 *     responses:
 *       200:
 *         description: Checkout session created (Stripe url + session id, or PayPal approvalUrl + orderId)
 *       400:
 *         description: Validation error, plan not configured, or PayPal not configured when provider=paypal
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant or plan not found
 *       500:
 *         description: Server error
 */
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const { planId, successUrl, cancelUrl, provider, billingCycle } = req.body as {
      planId: number;
      successUrl?: string;
      cancelUrl?: string;
      provider?: 'stripe' | 'paypal';
      billingCycle?: 'monthly' | 'annual';
    };
    if (!planId) return errorResponse(res, 'planId is required', 400);
    const paymentProvider = provider === 'paypal' ? 'paypal' : 'stripe';
    const selectedBillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly';

    const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const check = await assertOwnerOrAdmin(userId, restaurant.id);
    if (!check.ok) return errorResponse(res, check.msg, check.code);

    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan || !plan.isActive) return errorResponse(res, 'Plan not found or inactive', 404);

    // Prevent free plans from being purchased
    if (plan.title.toLowerCase().includes('free') || plan.price === 0) {
      return errorResponse(res, 'Free plans cannot be purchased', 400);
    }

    // Check if this is a renewal attempt
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        restaurantId: restaurant.id,
        planId: plan.id,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
    });

    if (existingSubscription) {
      if (
        existingSubscription.stripeSubscriptionId &&
        existingSubscription.autoRenew
      ) {
        return errorResponse(
          res,
          'You already have an active auto-renewing subscription managed by Stripe. Disable auto-renew in your dashboard if you want to change plans, or wait until the current period ends.',
          400,
        );
      }

      // Check if renewal is allowed (last 30 days) — PayPal / non-Stripe only
      const now = new Date();
      const daysUntilExpiry = Math.ceil(
        (existingSubscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry > 30) {
        return errorResponse(
          res,
          `Renewal is only available in the last 30 days. You can renew in ${daysUntilExpiry - 30} days.`,
          400,
        );
      }
    }

    // Block duplicate checkout while another Stripe subscription is still billing
    const otherActiveStripe = await prisma.subscription.findFirst({
      where: {
        restaurantId: restaurant.id,
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null },
        autoRenew: true,
        endDate: { gte: new Date() },
        ...(existingSubscription ? { id: { not: existingSubscription.id } } : {}),
      },
    });
    if (otherActiveStripe && paymentProvider === 'stripe') {
      return errorResponse(
        res,
        'Another auto-renewing Stripe subscription is still active. Disable auto-renew before starting a new checkout.',
        400,
      );
    }

    const appBase = process.env.APP_BASE_URL || 'http://localhost:3000';
    const defaultSuccess = `${appBase}/dashboard/subscription?status=success&session_id=`;
    const defaultCancel = `${appBase}/dashboard/subscription?status=cancel`;

    // --- PayPal flow ---
    if (paymentProvider === 'paypal') {
      if (!isPayPalConfigured()) return errorResponse(res, 'PayPal is not configured', 400);

      const paypalCancel = cancelUrl || defaultCancel;
      // PayPal redirects to return_url and appends &token=ORDER_ID
      const returnUrl = successUrl || `${appBase}/dashboard/subscription?status=success&provider=paypal`;

      const { orderId, approvalUrl } = await createPayPalOrder({
        amount: selectedBillingCycle === 'annual' ? (plan.annualPrice ?? plan.price * 12) : (plan.monthlyPrice ?? plan.price),
        currency: plan.currency || 'EUR',
        description: plan.title,
        returnUrl,
        cancelUrl: paypalCancel,
      });

      const payment = await prisma.payment.create({
        data: {
          userId,
          restaurantId: restaurant.id,
          amount: selectedBillingCycle === 'annual' ? (plan.annualPrice ?? plan.price * 12) : (plan.monthlyPrice ?? plan.price),
          currency: plan.currency || 'EUR',
          method: 'paypal',
          status: 'created',
          transactionId: orderId,
          checkoutSessionId: orderId,
          provider: 'paypal',
          paymentMethod: 'PayPal',
        },
      });

      const now = new Date();
      const durationDays = selectedBillingCycle === 'annual' ? 365 : 30;
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plan.id,
          startDate: now,
          endDate,
          status: 'PENDING',
          paymentId: payment.id,
          paymentStatus: 'unpaid',
          billingCycle: selectedBillingCycle,
        },
      });

      return successResponse(res, 'PayPal checkout created', { url: approvalUrl, id: orderId });
    }

    // --- Stripe flow ---
    const stripePriceId = await ensureStripePriceForPlan(plan, selectedBillingCycle);
    const stripeCustomerId = await ensureStripeCustomerForRestaurant(restaurant);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url:
        successUrl ||
        `${appBase}/dashboard/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appBase}/dashboard/subscription?status=cancel`,
      metadata: {
        restaurantId: restaurant.id,
        planId: String(plan.id),
        billingCycle: selectedBillingCycle,
      },
      subscription_data: checkoutSubscriptionData(plan.title, {
        restaurantId: restaurant.id,
        planId: String(plan.id),
        billingCycle: selectedBillingCycle,
      }),
    });

    // Create Payment (created state) and Subscription (pending)
    const payment = await prisma.payment.create({
      data: {
        userId,
        restaurantId: restaurant.id,
        amount: selectedBillingCycle === 'annual' ? (plan.annualPrice ?? plan.price * 12) : (plan.monthlyPrice ?? plan.price),
        currency: plan.currency || 'EUR',
        method: 'stripe',
        status: 'created',
        transactionId: session.id,
        checkoutSessionId: session.id,
        provider: 'stripe',
        paymentMethod: 'stripe',
      },
    });

    const now = new Date();
    const durationDays = selectedBillingCycle === 'annual' ? 365 : 30;
    const pendingEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        restaurantId: restaurant.id,
        planId: plan.id,
        startDate: now,
        endDate: pendingEnd,
        status: 'PENDING',
        paymentId: payment.id,
        paymentStatus: 'unpaid',
        billingCycle: selectedBillingCycle,
        autoRenew: true,
      },
    });

    return successResponse(res, 'Checkout session created', { url: session.url, id: session.id });
  } catch (err: any) {
    const message = err?.message || 'Stripe error';
    return errorResponse(res, message, 500);
  }
};

/**
 * @swagger
 * /restaurants/subscription/confirm:
 *   post:
 *     summary: Confirm Stripe checkout and activate subscription
 *     description: Confirms a Stripe Checkout Session (after redirect) and activates the corresponding restaurant subscription. Use this for Stripe only; for PayPal use POST /restaurants/subscription/confirm-paypal.
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "cs_test_123"
 *                 description: Stripe Checkout Session ID from redirect
 *     responses:
 *       200:
 *         description: Subscription activated
 *       400:
 *         description: Payment not completed or invalid session
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Related payment/subscription not found
 *       500:
 *         description: Server error
 */
export const confirmCheckoutSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) return errorResponse(res, 'sessionId is required', 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'] as any,
    });

    if (session.mode !== 'subscription') {
      return errorResponse(res, 'Invalid session mode', 400);
    }

    if (session.status !== 'complete' && session.payment_status !== 'paid') {
      return errorResponse(res, 'Payment not completed', 400);
    }

    // Find payment and subscription
    const payment = await prisma.payment.findFirst({ where: { checkoutSessionId: session.id } });
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    const subscriptionRow = await prisma.subscription.findFirst({
      where: { paymentId: payment.id },
      include: { plan: true },
    });
    if (!subscriptionRow) return errorResponse(res, 'Subscription not found', 404);

    // Check if there's already an active subscription for the same plan
    const existingActiveSub = await prisma.subscription.findFirst({
      where: {
        restaurantId: subscriptionRow.restaurantId,
        planId: subscriptionRow.planId,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
        id: { not: subscriptionRow.id }, // Exclude current subscription
      },
    });

    if (existingActiveSub) {
      await prisma.subscription.update({
        where: { id: existingActiveSub.id },
        data: { status: 'CANCELLED', autoRenew: false },
      });
    }

    const plan = subscriptionRow.plan;

    let stripeSubscriptionId: string | undefined;
    let stripeSync: ReturnType<typeof syncFieldsFromStripeSub> | null = null;

    const expanded = session.subscription;
    if (expanded && typeof expanded !== 'string') {
      stripeSync = syncFieldsFromStripeSub(expanded as StripeNS.Subscription);
      stripeSubscriptionId = stripeSync.stripeSubscriptionId;
    } else if (typeof session.subscription === 'string') {
      const s = await retrieveStripeSubscription(session.subscription);
      stripeSync = syncFieldsFromStripeSub(s);
      stripeSubscriptionId = stripeSync.stripeSubscriptionId;
    }

    // Get payment method from Stripe subscription
    let paymentMethod = 'stripe';
    if (stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        if (subscription.default_payment_method) {
          const pm = await stripe.paymentMethods.retrieve(
            subscription.default_payment_method as string,
          );
          paymentMethod = `${pm.type.toUpperCase()} (${pm.card?.brand || 'CARD'})`;
        }
      } catch (err) {
        console.log('Could not retrieve payment method:', err);
      }
    }

    const subscriptionUpdateData: Record<string, unknown> = {
      status: 'ACTIVE',
      paymentStatus: 'paid',
      paymentMethod,
      autoRenew: stripeSync?.autoRenew ?? true,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      stripeStatus: stripeSync?.stripeStatus ?? null,
    };

    if (stripeSync?.stripeCurrentPeriodStart) {
      subscriptionUpdateData.stripeCurrentPeriodStart = stripeSync.stripeCurrentPeriodStart;
      subscriptionUpdateData.startDate = stripeSync.stripeCurrentPeriodStart;
    }
    if (stripeSync?.stripeCurrentPeriodEnd) {
      subscriptionUpdateData.stripeCurrentPeriodEnd = stripeSync.stripeCurrentPeriodEnd;
      subscriptionUpdateData.endDate = stripeSync.stripeCurrentPeriodEnd;
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          receiptUrl: (session as any)?.invoice ? null : (payment.receiptUrl ?? null),
          paymentMethod: paymentMethod,
        },
      }),
      prisma.subscription.update({
        where: { id: subscriptionRow.id },
        data: subscriptionUpdateData,
      }),
      prisma.restaurant.update({
        where: { id: subscriptionRow.restaurantId },
        data: { isSubscriptionActive: true },
      }),
      // Create or update invoice for the subscription
      prisma.invoice.upsert({
        where: {
          stripeInvoiceId: (session as any)?.invoice || `manual_${payment.id}`,
        },
        update: {
          status: 'PAID',
          amountPaid: plan.price,
          paymentMethod: paymentMethod,
          periodStart: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodStart),
          periodEnd: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodEnd),
        },
        create: {
          restaurantId: subscriptionRow.restaurantId,
          subscriptionId: subscriptionRow.id,
          paymentId: payment.id,
          stripeInvoiceId: (session as any)?.invoice || `manual_${payment.id}`,
          hostedInvoiceUrl: (session as any)?.invoice
            ? `https://dashboard.stripe.com/invoices/${(session as any).invoice}`
            : null,
          pdfUrl: (session as any)?.invoice
            ? `https://dashboard.stripe.com/invoices/${(session as any).invoice}/pdf`
            : null,
          amountDue: plan.price,
          amountPaid: plan.price,
          currency: plan.currency || 'EUR',
          status: 'PAID',
          paymentMethod: paymentMethod,
          periodStart: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodStart),
          periodEnd: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodEnd),
        },
      }),
    ]);

    await finalizeSubscriptionActivation(
      subscriptionRow.restaurantId,
      subscriptionRow.id,
    );

    await cancelExistingStripeSubscriptionsForRestaurant(
      subscriptionRow.restaurantId,
      subscriptionRow.id,
    );

    return successResponse(res, 'Subscription activated', { subscriptionId: stripeSubscriptionId });
  } catch (err: any) {
    const message = err?.message || 'Stripe confirm error';
    return errorResponse(res, message, 500);
  }
};

/**
 * @swagger
 * /restaurants/subscription/confirm-paypal:
 *   post:
 *     summary: Confirm PayPal checkout and activate subscription
 *     description: Captures the PayPal order (after user approves on PayPal) and activates the restaurant subscription. Call this with the orderId received in the return URL query (e.g. ?token=ORDER_ID). Requires authentication.
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: PayPal order ID (token from PayPal return URL)
 *                 example: "8AB12345CD67890EF"
 *     responses:
 *       200:
 *         description: Subscription activated
 *       400:
 *         description: Payment not completed or invalid orderId
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment or subscription not found
 *       500:
 *         description: Server error
 */
export const confirmPayPalCheckout = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const { orderId } = req.body as { orderId: string };
    if (!orderId) return errorResponse(res, 'orderId is required', 400);

    await capturePayPalOrder(orderId);

    const payment = await prisma.payment.findFirst({
      where: { transactionId: orderId, provider: 'paypal' },
    });
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    const subscriptionRow = await prisma.subscription.findFirst({
      where: { paymentId: payment.id },
      include: { plan: true },
    });
    if (!subscriptionRow) return errorResponse(res, 'Subscription not found', 404);

    const now = new Date();
    const durationDays = subscriptionRow.billingCycle === 'annual' ? 365 : 30;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const invoiceAmount =
      subscriptionRow.billingCycle === 'annual'
        ? (subscriptionRow.plan.annualPrice ?? subscriptionRow.plan.price * 12)
        : (subscriptionRow.plan.monthlyPrice ?? subscriptionRow.plan.price);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'succeeded', paymentMethod: 'PayPal' },
      }),
      prisma.subscription.update({
        where: { id: subscriptionRow.id },
        data: {
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod: 'PayPal',
          endDate,
        },
      }),
      prisma.restaurant.update({
        where: { id: subscriptionRow.restaurantId },
        data: { isSubscriptionActive: true },
      }),
      prisma.invoice.upsert({
        where: { stripeInvoiceId: `paypal_${payment.id}` },
        update: {
          status: 'PAID',
          amountPaid: invoiceAmount,
          paymentMethod: 'PayPal',
          periodStart: now,
          periodEnd: endDate,
        },
        create: {
          restaurantId: subscriptionRow.restaurantId,
          subscriptionId: subscriptionRow.id,
          paymentId: payment.id,
          stripeInvoiceId: `paypal_${payment.id}`,
          amountDue: invoiceAmount,
          amountPaid: invoiceAmount,
          currency: subscriptionRow.plan.currency || 'EUR',
          status: 'PAID',
          paymentMethod: 'PayPal',
          periodStart: now,
          periodEnd: endDate,
        },
      }),
    ]);

    await finalizeSubscriptionActivation(
      subscriptionRow.restaurantId,
      subscriptionRow.id,
    );

    return successResponse(res, 'Subscription activated', { subscriptionId: orderId });
  } catch (err: any) {
    const message = err?.message || 'PayPal confirm error';
    return errorResponse(res, message, 500);
  }
};

/**
 * @swagger
 * /restaurants/subscription/webhook:
 *   post:
 *     summary: Stripe webhook (subscriptions, invoices, user wallet top-up)
 *     description: |
 *       Raw JSON body; use Stripe-Signature header. STRIPE_WEBHOOK_SECRET must match your Stripe dashboard endpoint.
 *       Handles checkout.session.completed, invoice.paid, invoice.payment_failed, and payment_intent.succeeded when
 *       metadata.wallet_purpose is wallet_topup (credits user ledger idempotently by payment intent id).
 *     tags: [Subscription]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event processed
 *       400:
 *         description: Invalid signature or bad payload
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    console.log('Webhook received:', req.headers);

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return res.status(400).send('Missing STRIPE_WEBHOOK_SECRET');
    }

    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      console.error('Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature');
    }

    let event: StripeNS.Event;
    try {
      // req.body is Buffer due to express.raw on the route
      event = getStripe().webhooks.constructEvent(req.body as any, signature, secret);
      console.log('Webhook event type:', event.type);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed event');
        const session = event.data.object as StripeNS.Checkout.Session;
        console.log('Session ID:', session.id);

        // Activate initial subscription
        const payment = await prisma.payment.findFirst({
          where: { checkoutSessionId: session.id },
        });
        if (!payment) {
          console.error('Payment not found for session:', session.id);
          break;
        }

        const subscriptionRow = await prisma.subscription.findFirst({
          where: { paymentId: payment.id },
          include: { plan: true },
        });
        if (!subscriptionRow) {
          console.error('Subscription not found for payment:', payment.id);
          break;
        }

        // Check if there's already an active subscription for the same plan
        const existingActiveSub = await prisma.subscription.findFirst({
          where: {
            restaurantId: subscriptionRow.restaurantId,
            planId: subscriptionRow.planId,
            status: 'ACTIVE',
            endDate: { gte: new Date() },
            id: { not: subscriptionRow.id }, // Exclude current subscription
          },
        });

        if (existingActiveSub) {
          await prisma.subscription.update({
            where: { id: existingActiveSub.id },
            data: { status: 'CANCELLED', autoRenew: false },
          });
        }

        let stripeSubscriptionId: string | undefined;
        let stripeSync: ReturnType<typeof syncFieldsFromStripeSub> | null = null;
        if (session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as { id: string }).id;
          const s = await retrieveStripeSubscription(subId);
          stripeSync = syncFieldsFromStripeSub(s);
          stripeSubscriptionId = stripeSync.stripeSubscriptionId;
        }

        // Get payment method from Stripe subscription
        let paymentMethod = 'stripe';
        if (stripeSubscriptionId) {
          try {
            const subscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
            if (subscription.default_payment_method) {
              const pm = await getStripe().paymentMethods.retrieve(
                subscription.default_payment_method as string,
              );
              paymentMethod = `${pm.type.toUpperCase()} (${pm.card?.brand || 'CARD'})`;
            }
          } catch (err) {
            console.log('Could not retrieve payment method:', err);
          }
        }

        const subscriptionUpdateData: Record<string, unknown> = {
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod,
          autoRenew: stripeSync?.autoRenew ?? true,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
          stripeStatus: stripeSync?.stripeStatus ?? null,
        };

        if (stripeSync?.stripeCurrentPeriodStart) {
          subscriptionUpdateData.stripeCurrentPeriodStart = stripeSync.stripeCurrentPeriodStart;
          subscriptionUpdateData.startDate = stripeSync.stripeCurrentPeriodStart;
        }
        if (stripeSync?.stripeCurrentPeriodEnd) {
          subscriptionUpdateData.stripeCurrentPeriodEnd = stripeSync.stripeCurrentPeriodEnd;
          subscriptionUpdateData.endDate = stripeSync.stripeCurrentPeriodEnd;
        }

        // Get plan data for invoice
        const plan = await prisma.plan.findUnique({
          where: { id: subscriptionRow.planId },
        });

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'succeeded',
              receiptUrl: payment.receiptUrl ?? null,
              paymentMethod: paymentMethod,
            },
          }),
          prisma.subscription.update({
            where: { id: subscriptionRow.id },
            data: subscriptionUpdateData,
          }),
          prisma.restaurant.update({
            where: { id: subscriptionRow.restaurantId },
            data: { isSubscriptionActive: true },
          }),
          // Create or update invoice for the subscription
          prisma.invoice.upsert({
            where: {
              stripeInvoiceId: (session as any)?.invoice || `manual_${payment.id}`,
            },
            update: {
              status: 'PAID',
              amountPaid: plan?.price || 0,
              paymentMethod: paymentMethod,
              periodStart: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodStart),
              periodEnd: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodEnd),
            },
            create: {
              restaurantId: subscriptionRow.restaurantId,
              subscriptionId: subscriptionRow.id,
              paymentId: payment.id,
              stripeInvoiceId: (session as any)?.invoice || `manual_${payment.id}`,
              hostedInvoiceUrl: (session as any)?.invoice
                ? `https://dashboard.stripe.com/invoices/${(session as any).invoice}`
                : null,
              pdfUrl: (session as any)?.invoice
                ? `https://dashboard.stripe.com/invoices/${(session as any).invoice}/pdf`
                : null,
              amountDue: plan?.price || 0,
              amountPaid: plan?.price || 0,
              currency: plan?.currency || 'EUR',
              status: 'PAID',
              paymentMethod: paymentMethod,
              periodStart: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodStart),
              periodEnd: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodEnd),
            },
          }),
        ]);
        await finalizeSubscriptionActivation(
          subscriptionRow.restaurantId,
          subscriptionRow.id,
        );
        await cancelExistingStripeSubscriptionsForRestaurant(
          subscriptionRow.restaurantId,
          subscriptionRow.id,
        );
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as StripeNS.Invoice;
        const invFull = await getStripe().invoices.retrieve(inv.id ?? '');
        const subId = ((invFull as { subscription?: string | null }).subscription as string) ?? null;
        if (!subId) break;
        const s = await retrieveStripeSubscription(subId);
        const row = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: s.id } });
        if (!row) break;

        const stripeSync = syncFieldsFromStripeSub(s);

        // Get payment method from Stripe subscription
        let paymentMethod = 'stripe';
        try {
          if (s.default_payment_method) {
            const pm = await getStripe().paymentMethods.retrieve(
              s.default_payment_method as string,
            );
            paymentMethod = `${pm.type.toUpperCase()} (${pm.card?.brand || 'CARD'})`;
          }
        } catch (err) {
          console.log('Could not retrieve payment method:', err);
        }

        const subscriptionUpdateData: Record<string, unknown> = {
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod,
          autoRenew: stripeSync.autoRenew,
          stripeStatus: stripeSync.stripeStatus,
        };

        if (stripeSync.stripeCurrentPeriodStart) {
          subscriptionUpdateData.stripeCurrentPeriodStart = stripeSync.stripeCurrentPeriodStart;
        }
        if (stripeSync.stripeCurrentPeriodEnd) {
          subscriptionUpdateData.stripeCurrentPeriodEnd = stripeSync.stripeCurrentPeriodEnd;
          subscriptionUpdateData.endDate = stripeSync.stripeCurrentPeriodEnd;
        }

        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: row.id },
            data: subscriptionUpdateData,
          }),
          prisma.restaurant.update({
            where: { id: row.restaurantId },
            data: { isSubscriptionActive: true },
          }),
          prisma.invoice.upsert({
            where: { stripeInvoiceId: inv.id ?? '' },
            update: {
              status: 'PAID',
              amountPaid: (inv.amount_paid ?? 0) / 100,
              paymentMethod: paymentMethod,
            },
            create: {
              restaurantId: row.restaurantId,
              subscriptionId: row.id,
              stripeInvoiceId: inv.id ?? '',
              hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
              pdfUrl: inv.invoice_pdf ?? null,
              amountDue: (inv.amount_due ?? 0) / 100,
              amountPaid: (inv.amount_paid ?? 0) / 100,
              currency: (inv.currency || 'EUR').toUpperCase(),
              status: 'PAID',
              paymentMethod: paymentMethod,
              periodStart: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodStart),
              periodEnd: periodOrNow(subscriptionUpdateData.stripeCurrentPeriodEnd),
            },
          }),
        ]);
        await finalizeSubscriptionActivation(row.restaurantId, row.id);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const s = event.data.object as StripeNS.Subscription;
        const row = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: s.id },
        });
        if (!row) break;

        const stripeSync = syncFieldsFromStripeSub(s);
        const updateData: Record<string, unknown> = {
          autoRenew: stripeSync.autoRenew,
          stripeStatus: stripeSync.stripeStatus,
        };

        if (stripeSync.stripeCurrentPeriodStart) {
          updateData.stripeCurrentPeriodStart = stripeSync.stripeCurrentPeriodStart;
        }
        if (stripeSync.stripeCurrentPeriodEnd) {
          updateData.stripeCurrentPeriodEnd = stripeSync.stripeCurrentPeriodEnd;
          updateData.endDate = stripeSync.stripeCurrentPeriodEnd;
        }

        if (event.type === 'customer.subscription.deleted' || s.status === 'canceled') {
          updateData.status = 'CANCELLED';
          updateData.autoRenew = false;
        } else if (s.status === 'active' || s.status === 'trialing') {
          updateData.status = 'ACTIVE';
          updateData.paymentStatus = 'paid';
        }

        await prisma.subscription.update({
          where: { id: row.id },
          data: updateData,
        });

        const stillActive = await prisma.subscription.count({
          where: {
            restaurantId: row.restaurantId,
            status: 'ACTIVE',
            endDate: { gte: new Date() },
          },
        });
        await prisma.restaurant.update({
          where: { id: row.restaurantId },
          data: { isSubscriptionActive: stillActive > 0 },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as StripeNS.Invoice;
        const invoiceId = inv.id ?? '';
        if (!invoiceId) break;

        const invFull = await getStripe().invoices.retrieve(invoiceId);
        const subId =
          ((invFull as any).subscription as string) ??
          (((invFull as any).lines?.data?.[0] as any)?.subscription as string) ??
          null;
        if (!subId) break;

        const s = (await getStripe().subscriptions.retrieve(subId)) as StripeNS.Subscription;
        const row = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: s.id } });
        if (!row) break;
        await prisma.subscription.update({
          where: { id: row.id },
          data: { paymentStatus: 'unpaid' },
        });
        await prisma.invoice.upsert({
          where: { stripeInvoiceId: invoiceId },
          update: { status: 'FAILED' },
          create: {
            restaurantId: row.restaurantId,
            subscriptionId: row.id,
            stripeInvoiceId: invoiceId,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
            pdfUrl: inv.invoice_pdf ?? null,
            amountDue: (inv.amount_due ?? 0) / 100,
            amountPaid: (inv.amount_paid ?? 0) / 100,
            currency: (inv.currency || 'EUR').toUpperCase(),
            status: 'FAILED',
          },
        });
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as StripeNS.PaymentIntent;
        const amountReceived = pi.amount_received ?? pi.amount;
        const currency = (pi.currency || 'eur').toUpperCase();
        const meta = pi.metadata as Record<string, string> | undefined;
        if (meta?.wallet_purpose === 'wallet_topup' && meta?.userId) {
          await walletService.applyStripeTopUp({
            paymentIntentId: pi.id,
            amountReceivedCents: amountReceived,
            currency,
            userId: meta.userId,
            metadata: meta,
          });
        } else if (meta?.wallet_purpose === 'restaurant_wallet_topup' && meta?.restaurantId) {
          await walletService.applyStripeRestaurantTopUp({
            paymentIntentId: pi.id,
            amountReceivedCents: amountReceived,
            currency,
            restaurantId: meta.restaurantId,
            metadata: meta,
          });
        }
        break;
      }
      default:
        // Ignore unhandled events
        break;
    }

    console.log('Webhook processed successfully');
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).send(err?.message || 'Webhook handler error');
  }
};

/**
 * Toggle auto-renewal (synced with Stripe cancel_at_period_end).
 */
export const setSubscriptionAutoRenew = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const { enabled } = req.body as { enabled: boolean };
    if (typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled (boolean) is required', 400);
    }

    const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const check = await assertOwnerOrAdmin(userId, restaurant.id);
    if (!check.ok) return errorResponse(res, check.msg, check.code);

    const subscription = await prisma.subscription.findFirst({
      where: {
        restaurantId: restaurant.id,
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null },
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription?.stripeSubscriptionId) {
      return errorResponse(
        res,
        'No active Stripe-managed subscription found. Auto-renew applies to card subscriptions only.',
        404,
      );
    }

    const stripeSub = await setStripeAutoRenew(subscription.stripeSubscriptionId, enabled);
    const sync = syncFieldsFromStripeSub(stripeSub);

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: sync.autoRenew,
        stripeStatus: sync.stripeStatus,
        ...(sync.stripeCurrentPeriodEnd ? { endDate: sync.stripeCurrentPeriodEnd } : {}),
        ...(sync.stripeCurrentPeriodEnd
          ? { stripeCurrentPeriodEnd: sync.stripeCurrentPeriodEnd }
          : {}),
      },
    });

    return successResponse(res, 'Auto-renew updated', {
      autoRenew: updated.autoRenew,
      endDate: updated.endDate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update auto-renew';
    return errorResponse(res, message, 500);
  }
};
