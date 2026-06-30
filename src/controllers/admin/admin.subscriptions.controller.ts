import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { sendNotificationToUser } from '../../services/notification.service';
import { finalizeSubscriptionActivation } from '../../utils/subscription';
import { sendSubscriptionRefundEmail } from '../../utils/email';
import {
  cancelStripeSubscriptionImmediately,
} from '../../utils/stripeSubscriptionSync';
import { getStripeClient } from '../../lib/stripeClient';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Subscriptions
 *     description: Admin subscriptions management endpoints
 */

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: Get all subscriptions with optional filters, pagination, and search
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by restaurant name or owner full name
 *       - in: query
 *         name: planId
 *         schema:
 *           type: number
 *         description: Filter by plan ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by subscription status  "PENDING"  "ACTIVE" "CANCELLED"  "EXPIRED"
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: number
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 *       500:
 *         description: Internal server error
 */

export const getAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const { search, planId, status, page = '1', pageSize = '10' } = req.query;

    const where: any = {};

    // Filter by search keyword (restaurant name or owner full name)
    if (search) {
      where.OR = [
        { restaurant: { name: { contains: String(search), mode: 'insensitive' } } },
        { restaurant: { owner: { fullName: { contains: String(search), mode: 'insensitive' } } } },
      ];
    }

    // Filter by plan ID
    if (planId && planId !== 'all') {
      const planIdNum = Number(planId);
      if (!isNaN(planIdNum)) where.planId = planIdNum;
    }

    // Filter by subscription status
    if (status && status !== 'all') {
      where.status = status;
    }

    // Pagination setup
    const pageNumber = Math.max(Number(page), 1);
    const size = Math.max(Number(pageSize), 1);
    const skip = (pageNumber - 1) * size;

    // Fetch subscriptions with pagination and include related restaurant and plan
    // Group by restaurant and plan to get only one subscription per plan per restaurant
    const allSubscriptions = await prisma.subscription.findMany({
      where,
      include: {
        restaurant: {
          include: { owner: { select: { id: true, fullName: true, email: true } } },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by restaurantId and planId to get the latest subscription for each plan
    const groupedSubscriptions = new Map();
    allSubscriptions.forEach((sub) => {
      const key = `${sub.restaurantId}-${sub.planId}`;
      if (
        !groupedSubscriptions.has(key) ||
        sub.createdAt > groupedSubscriptions.get(key).createdAt
      ) {
        groupedSubscriptions.set(key, sub);
      }
    });

    const items = Array.from(groupedSubscriptions.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + size);

    // Count total unique subscriptions (one per plan per restaurant)
    const totalItems = groupedSubscriptions.size;
    const totalPages = Math.ceil(totalItems / size);

    // Calculate statistics for different statuses
    const activeCount = await prisma.subscription.count({ where: { ...where, status: 'ACTIVE' } });
    const cancelledCount = await prisma.subscription.count({
      where: { ...where, status: 'CANCELLED' },
    });
    const expiredCount = await prisma.subscription.count({
      where: { ...where, status: 'EXPIRED' },
    });

    // Calculate total value of subscriptions (sum of plan prices)
    const totalValue = await prisma.subscription
      .findMany({
        where,
        include: { plan: true },
      })
      .then((subs) => subs.reduce((sum, s) => sum + (s.plan?.price || 0), 0));

    // Prepare statistics object
    const statistics = {
      active: activeCount,
      cancelled: cancelledCount,
      expired: expiredCount,
      totalValue,
    };

    // Return subscriptions, pagination info, and statistics
    return successResponse(res, 'Subscriptions retrieved successfully', {
      items,
      pagination: { totalItems, totalPages, currentPage: pageNumber, pageSize: size },
      statistics,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/subscriptions/cancel/{id}:
 *   put:
 *     summary: Cancel a subscription and notify the restaurant owner
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: Subscription ID to cancel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       400:
 *         description: Subscription cannot be cancelled
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Internal server error
 */

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { id: Number(id) },
      include: { restaurant: true },
    });

    if (!subscription) return errorResponse(res, 'Subscription not found', 404);

    if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED') {
      return errorResponse(res, 'Subscription cannot be cancelled', 400);
    }

    if (subscription.stripeSubscriptionId) {
      await cancelStripeSubscriptionImmediately(subscription.stripeSubscriptionId);
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        autoRenew: false,
        ...(subscription.stripeSubscriptionId ? { stripeStatus: 'canceled' } : {}),
      },
      include: {
        plan: true,
        restaurant: { include: { owner: true } },
      },
    });

    const activeSubs = await prisma.subscription.count({
      where: {
        restaurantId: subscription.restaurantId,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
    });

    await prisma.restaurant.update({
      where: { id: subscription.restaurantId },
      data: {
        isSubscriptionActive: activeSubs > 0,
      },
    });

    await sendNotificationToUser({
      userId: subscription.restaurant.userId,
      title: 'Subscription Cancelled',
      body: `Your subscription has been cancelled: ${reason}`,
      type: 'SUBSCRIPTION_CANCELLED',
    });

    return successResponse(res, 'Subscription cancelled successfully', updatedSubscription);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/subscriptions/activate:
 *   post:
 *     summary: Activate or extend a subscription for a restaurant
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *               planId:
 *                 type: number
 *                 description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription activated or extended successfully
 *       404:
 *         description: Restaurant or plan not found
 *       500:
 *         description: Internal server error
 */
export const activateSubscription = async (req: Request, res: Response) => {
  try {
    const { restaurantId, planId } = req.body;

    if (!restaurantId || !planId) {
      return errorResponse(res, 'restaurantId and planId are required', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan) return errorResponse(res, 'Plan not found', 404);

    // Check if it's a free plan - prevent admin from activating free plans
    if (plan.title.toLowerCase().includes('free') || plan.price === 0) {
      return errorResponse(res, 'Free plans cannot be activated by admin', 400);
    }

    // Find existing subscription for the same plan
    const existingSub = await prisma.subscription.findFirst({
      where: {
        restaurantId,
        planId: plan.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    let subscription;

    if (existingSub) {
      // Extend existing subscription for the same plan
      const newEndDate = new Date(existingSub.endDate);
      newEndDate.setDate(newEndDate.getDate() + plan.duration);

      subscription = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          endDate: newEndDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod: 'admin_activation',
        },
        include: {
          restaurant: { include: { owner: true } },
          plan: true,
        },
      });
    } else {
      // Create new subscription for different plan
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration);

      subscription = await prisma.subscription.create({
        data: {
          restaurantId,
          planId: plan.id,
          startDate: new Date(),
          endDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod: 'admin_activation',
        },
        include: {
          restaurant: { include: { owner: true } },
          plan: true,
        },
      });
    }

    // Update restaurant status
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isSubscriptionActive: true,
        isActive: true,
      },
    });

    await finalizeSubscriptionActivation(restaurantId, subscription.id);

    return successResponse(res, 'Subscription activated/extended successfully', subscription);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * Refund the latest Stripe payment for a subscription (full or partial).
 */
export const refundSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason, apologyMessage } = req.body as {
      amount?: number;
      reason?: string;
      apologyMessage?: string;
    };

    const subscription = await prisma.subscription.findUnique({
      where: { id: Number(id) },
      include: {
        plan: true,
        restaurant: { include: { owner: true } },
        invoices: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) return errorResponse(res, 'Subscription not found', 404);

    const stripeInvoice = subscription.invoices.find(
      (inv) =>
        inv.stripeInvoiceId &&
        !inv.stripeInvoiceId.startsWith('manual_') &&
        !inv.stripeInvoiceId.startsWith('paypal_'),
    );

    if (!stripeInvoice?.stripeInvoiceId) {
      return errorResponse(res, 'No refundable Stripe invoice found for this subscription', 400);
    }

    const stripe = getStripeClient();
    const invoice = await stripe.invoices.retrieve(stripeInvoice.stripeInvoiceId);
    const invAny = invoice as { payment_intent?: string | { id: string } | null };
    const paymentIntentId =
      typeof invAny.payment_intent === 'string'
        ? invAny.payment_intent
        : invAny.payment_intent?.id;

    if (!paymentIntentId) {
      return errorResponse(res, 'No payment intent linked to this invoice', 400);
    }

    const refundParams: {
      payment_intent: string;
      amount?: number;
      reason: 'requested_by_customer';
      metadata: Record<string, string>;
    } = {
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        subscriptionId: String(subscription.id),
        restaurantId: subscription.restaurantId,
        adminRefund: 'true',
        reason: reason || 'Admin refund',
      },
    };

    if (amount != null && amount > 0) {
      refundParams.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundParams);

    const refundedAmount = (refund.amount ?? 0) / 100;
    const currency = refund.currency?.toUpperCase() ?? 'EUR';
    const apology = apologyMessage?.trim();
    const owner = subscription.restaurant.owner;
    const ownerId = subscription.restaurant.userId;
    const planTitle = subscription.plan?.title ?? 'subscription';
    const restaurantName = subscription.restaurant.name;

    const defaultApologyEn =
      'We apologize for any inconvenience. A refund has been processed for your subscription.';
    const notificationApology = apology || defaultApologyEn;

    await sendNotificationToUser({
      userId: ownerId,
      title: 'Refund issued — NUX',
      body: `${notificationApology}\n\nWe have refunded ${refundedAmount.toFixed(2)} ${currency} for your ${planTitle} plan (${restaurantName}). The amount will appear on your card within 5–10 business days.`,
      type: 'SUBSCRIPTION_REFUND',
      data: {
        subscriptionId: String(subscription.id),
        refundId: refund.id,
        amount: String(refundedAmount),
        currency,
      },
    });

    if (owner?.email) {
      try {
        await sendSubscriptionRefundEmail({
          to: owner.email,
          ownerName: owner.fullName,
          restaurantName,
          planName: planTitle,
          amount: refundedAmount,
          currency,
          refundId: refund.id,
          ...(apology ? { apologyMessage: apology } : {}),
        });
      } catch (emailErr) {
        console.error('Refund confirmation email failed:', emailErr);
      }
    }

    return successResponse(res, 'Refund issued successfully', {
      refundId: refund.id,
      amount: refundedAmount,
      currency,
      status: refund.status,
      notificationSent: true,
      emailSent: Boolean(owner?.email),
      apologyIncluded: Boolean(apology),
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Refund failed';
    return errorResponse(res, message, 500);
  }
};
