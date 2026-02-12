import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { errorResponse, successResponse } from '../../utils/response';
import { assertOwnerOrAdmin } from '../../utils/check_restauran-owner';
import type StripeNS from 'stripe';
import {
  createPayPalOrder,
  capturePayPalOrder,
  isPayPalConfigured,
} from '../../lib/paypal';

/**
 * @swagger
 * tags:
 *   - name: Subscription
 *     description: Restaurant subscription checkout and activation via Stripe or PayPal
 */
const prisma = new PrismaClient();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing');
  return new Stripe(key, { apiVersion: '2025-08-27.basil' });
}
const stripe = getStripe();

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

    const { planId, successUrl, cancelUrl, provider } = req.body as {
      planId: number;
      successUrl?: string;
      cancelUrl?: string;
      provider?: 'stripe' | 'paypal';
    };
    if (!planId) return errorResponse(res, 'planId is required', 400);
    const paymentProvider = provider === 'paypal' ? 'paypal' : 'stripe';

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
      // Check if renewal is allowed (last 30 days)
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
        amount: plan.price,
        currency: plan.currency || 'EUR',
        description: plan.title,
        returnUrl,
        cancelUrl: paypalCancel,
      });

      const payment = await prisma.payment.create({
        data: {
          userId,
          restaurantId: restaurant.id,
          amount: plan.price,
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
      const endDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plan.id,
          startDate: now,
          endDate,
          status: 'PENDING',
          paymentId: payment.id,
          paymentStatus: 'unpaid',
        },
      });

      return successResponse(res, 'PayPal checkout created', { url: approvalUrl, id: orderId });
    }

    // --- Stripe flow ---
    if (!plan.stripePriceId)
      return errorResponse(res, 'Plan is not configured for Stripe subscriptions', 400);

    let stripeCustomerId = restaurant.stripeCustomerId || undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: { restaurantId: restaurant.id },
      });
      stripeCustomerId = customer.id;
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { stripeCustomerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url:
        successUrl ||
        `${appBase}/dashboard/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appBase}/dashboard/subscription?status=cancel`,
      metadata: {
        restaurantId: restaurant.id,
        planId: String(plan.id),
      },
    });

    // Create Payment (created state) and Subscription (pending)
    const payment = await prisma.payment.create({
      data: {
        userId,
        restaurantId: restaurant.id,
        amount: plan.price,
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
    const endDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        restaurantId: restaurant.id,
        planId: plan.id,
        startDate: now,
        endDate,
        status: 'PENDING',
        paymentId: payment.id,
        paymentStatus: 'unpaid',
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
      // Extend existing subscription instead of creating new one
      const newEndDate = new Date(existingActiveSub.endDate);
      newEndDate.setDate(newEndDate.getDate() + subscriptionRow.plan.duration);

      await prisma.subscription.update({
        where: { id: existingActiveSub.id },
        data: {
          endDate: newEndDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
        },
      });

      // Delete the duplicate subscription
      await prisma.subscription.delete({
        where: { id: subscriptionRow.id },
      });

      // Update the subscriptionRow to point to the existing one
      subscriptionRow.id = existingActiveSub.id;
    }

    const plan = subscriptionRow.plan;

    // If Stripe subscription exists, capture period dates
    let stripeSubscriptionId: string | undefined;
    let currentPeriodStart: Date | undefined;
    let currentPeriodEnd: Date | undefined;

    const expanded = session.subscription;
    console.log('Session subscription:', expanded);

    if (expanded && typeof expanded !== 'string') {
      const s = expanded as Stripe.Subscription;
      console.log('Expanded subscription:', s);

      // Try current_period_start/end first, then fallback to billing_cycle_anchor
      let periodStart = (s as any).current_period_start;
      let periodEnd = (s as any).current_period_end;

      // If current_period_start is not available, use billing_cycle_anchor
      if (!periodStart && s.billing_cycle_anchor) {
        periodStart = s.billing_cycle_anchor;
        // Calculate end date based on plan interval from items
        if (s.items && s.items.data && s.items.data.length > 0) {
          const item = s.items.data[0] as any;
          if (item.price && item.price.interval && item.price.interval_count) {
            const intervalMs =
              item.price.interval === 'day'
                ? item.price.interval_count * 24 * 60 * 60 * 1000
                : item.price.interval === 'week'
                  ? item.price.interval_count * 7 * 24 * 60 * 60 * 1000
                  : item.price.interval === 'month'
                    ? item.price.interval_count * 30 * 24 * 60 * 60 * 1000
                    : item.price.interval === 'year'
                      ? item.price.interval_count * 365 * 24 * 60 * 60 * 1000
                      : item.price.interval_count * 30 * 24 * 60 * 60 * 1000; // Default to month
            periodEnd = periodStart + intervalMs / 1000;
          }
        }
      }

      console.log('Period start:', periodStart, 'Period end:', periodEnd);

      if (periodStart && typeof periodStart === 'number') {
        currentPeriodStart = new Date(periodStart * 1000);
        console.log('Converted period start:', currentPeriodStart);
      }
      if (periodEnd && typeof periodEnd === 'number') {
        currentPeriodEnd = new Date(periodEnd * 1000);
        console.log('Converted period end:', currentPeriodEnd);
      }
      stripeSubscriptionId = s.id;
    } else if (typeof session.subscription === 'string') {
      console.log('Retrieving subscription:', session.subscription);
      const s = (await stripe.subscriptions.retrieve(session.subscription)) as Stripe.Subscription;
      console.log('Retrieved subscription:', s);

      // Try current_period_start/end first, then fallback to billing_cycle_anchor
      let periodStart = (s as any).current_period_start;
      let periodEnd = (s as any).current_period_end;

      // If current_period_start is not available, use billing_cycle_anchor
      if (!periodStart && s.billing_cycle_anchor) {
        periodStart = s.billing_cycle_anchor;
        // Calculate end date based on plan interval from items
        if (s.items && s.items.data && s.items.data.length > 0) {
          const item = s.items.data[0] as any;
          if (item.price && item.price.interval && item.price.interval_count) {
            const intervalMs =
              item.price.interval === 'day'
                ? item.price.interval_count * 24 * 60 * 60 * 1000
                : item.price.interval === 'week'
                  ? item.price.interval_count * 7 * 24 * 60 * 60 * 1000
                  : item.price.interval === 'month'
                    ? item.price.interval_count * 30 * 24 * 60 * 60 * 1000
                    : item.price.interval === 'year'
                      ? item.price.interval_count * 365 * 24 * 60 * 60 * 1000
                      : item.price.interval_count * 30 * 24 * 60 * 60 * 1000; // Default to month
            periodEnd = periodStart + intervalMs / 1000;
          }
        }
      }

      console.log('Period start:', periodStart, 'Period end:', periodEnd);

      if (periodStart && typeof periodStart === 'number') {
        currentPeriodStart = new Date(periodStart * 1000);
        console.log('Converted period start:', currentPeriodStart);
      }
      if (periodEnd && typeof periodEnd === 'number') {
        currentPeriodEnd = new Date(periodEnd * 1000);
        console.log('Converted period end:', currentPeriodEnd);
      }
      stripeSubscriptionId = s.id;
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

    // Prepare update data with proper date validation
    const subscriptionUpdateData: any = {
      status: 'ACTIVE',
      paymentStatus: 'paid',
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      paymentMethod: paymentMethod,
    };

    // Only add period dates if they are valid
    console.log(
      'Final period start:',
      currentPeriodStart,
      'Valid:',
      currentPeriodStart && !isNaN(currentPeriodStart.getTime()),
    );
    console.log(
      'Final period end:',
      currentPeriodEnd,
      'Valid:',
      currentPeriodEnd && !isNaN(currentPeriodEnd.getTime()),
    );

    if (currentPeriodStart && !isNaN(currentPeriodStart.getTime())) {
      subscriptionUpdateData.stripeCurrentPeriodStart = currentPeriodStart;
    }
    if (currentPeriodEnd && !isNaN(currentPeriodEnd.getTime())) {
      subscriptionUpdateData.stripeCurrentPeriodEnd = currentPeriodEnd;
    }

    console.log('Final subscription update data:', subscriptionUpdateData);

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
          periodStart: subscriptionUpdateData.stripeCurrentPeriodStart || new Date(),
          periodEnd: subscriptionUpdateData.stripeCurrentPeriodEnd || new Date(),
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
          periodStart: subscriptionUpdateData.stripeCurrentPeriodStart || new Date(),
          periodEnd: subscriptionUpdateData.stripeCurrentPeriodEnd || new Date(),
        },
      }),
    ]);

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

    const plan = subscriptionRow.plan;
    const now = new Date();
    const endDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

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
          amountPaid: plan.price,
          paymentMethod: 'PayPal',
          periodStart: now,
          periodEnd: endDate,
        },
        create: {
          restaurantId: subscriptionRow.restaurantId,
          subscriptionId: subscriptionRow.id,
          paymentId: payment.id,
          stripeInvoiceId: `paypal_${payment.id}`,
          amountDue: plan.price,
          amountPaid: plan.price,
          currency: plan.currency || 'EUR',
          status: 'PAID',
          paymentMethod: 'PayPal',
          periodStart: now,
          periodEnd: endDate,
        },
      }),
    ]);

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
 *     summary: Stripe webhook (subscriptions & invoices)
 *     description: Consumes Stripe events to activate/renew subscriptions and record invoices. Verifies signature using STRIPE_WEBHOOK_SECRET.
 *     tags: [Subscription]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Event processed }
 *       400: { description: Invalid signature or bad payload }
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
          // Extend existing subscription instead of creating new one
          const newEndDate = new Date(existingActiveSub.endDate);
          newEndDate.setDate(newEndDate.getDate() + subscriptionRow.plan.duration);

          await prisma.subscription.update({
            where: { id: existingActiveSub.id },
            data: {
              endDate: newEndDate,
              status: 'ACTIVE',
              paymentStatus: 'paid',
            },
          });

          // Delete the duplicate subscription
          await prisma.subscription.delete({
            where: { id: subscriptionRow.id },
          });

          // Update the subscriptionRow to point to the existing one
          subscriptionRow.id = existingActiveSub.id;
        }

        let stripeSubscriptionId: string | undefined;
        let currentPeriodStart: Date | undefined;
        let currentPeriodEnd: Date | undefined;
        if (session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as any).id;
          const s = (await getStripe().subscriptions.retrieve(subId)) as StripeNS.Subscription;
          stripeSubscriptionId = s.id;

          const periodStart = (s as any)['current_period_start'];
          const periodEnd = (s as any)['current_period_end'];

          if (periodStart && typeof periodStart === 'number') {
            currentPeriodStart = new Date(periodStart * 1000);
          }
          if (periodEnd && typeof periodEnd === 'number') {
            currentPeriodEnd = new Date(periodEnd * 1000);
          }
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

        // Prepare update data with proper date validation
        const subscriptionUpdateData: any = {
          status: 'ACTIVE',
          paymentStatus: 'paid',
          stripeSubscriptionId: stripeSubscriptionId ?? null,
          paymentMethod: paymentMethod,
        };

        // Only add period dates if they are valid
        if (currentPeriodStart && !isNaN(currentPeriodStart.getTime())) {
          subscriptionUpdateData.stripeCurrentPeriodStart = currentPeriodStart;
        }
        if (currentPeriodEnd && !isNaN(currentPeriodEnd.getTime())) {
          subscriptionUpdateData.stripeCurrentPeriodEnd = currentPeriodEnd;
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
              periodStart: subscriptionUpdateData.stripeCurrentPeriodStart || new Date(),
              periodEnd: subscriptionUpdateData.stripeCurrentPeriodEnd || new Date(),
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
              periodStart: subscriptionUpdateData.stripeCurrentPeriodStart || new Date(),
              periodEnd: subscriptionUpdateData.stripeCurrentPeriodEnd || new Date(),
            },
          }),
        ]);
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as StripeNS.Invoice;
        const invFull = await getStripe().invoices.retrieve(inv.id ?? '');
        const subId = ((invFull as any).subscription as string) ?? null;
        if (!subId) break;
        const s = (await getStripe().subscriptions.retrieve(subId)) as StripeNS.Subscription;
        const row = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: s.id } });
        if (!row) break;

        const periodStart = (s as any)['current_period_start'];
        const periodEnd = (s as any)['current_period_end'];

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

        // Prepare update data with proper date validation
        const subscriptionUpdateData: any = {
          status: 'ACTIVE',
          paymentMethod: paymentMethod,
        };

        // Only add period dates if they are valid
        if (periodStart && typeof periodStart === 'number') {
          const cps = new Date(periodStart * 1000);
          if (!isNaN(cps.getTime())) {
            subscriptionUpdateData.stripeCurrentPeriodStart = cps;
          }
        }
        if (periodEnd && typeof periodEnd === 'number') {
          const cpe = new Date(periodEnd * 1000);
          if (!isNaN(cpe.getTime())) {
            subscriptionUpdateData.stripeCurrentPeriodEnd = cpe;
          }
        }

        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: row.id },
            data: subscriptionUpdateData,
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
              periodStart: subscriptionUpdateData.stripeCurrentPeriodStart || new Date(),
              periodEnd: subscriptionUpdateData.stripeCurrentPeriodEnd || new Date(),
            },
          }),
        ]);
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
