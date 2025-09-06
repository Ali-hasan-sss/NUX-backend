import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { sendNotificationToUser } from '../../services/notification.service';

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
    const items = await prisma.subscription.findMany({
      where,
      include: {
        restaurant: {
          include: { owner: { select: { id: true, fullName: true, email: true } } },
        },
        plan: true,
      },
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
    });

    // Count total subscriptions matching the filter
    const totalItems = await prisma.subscription.count({ where });
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

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
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

    const existingSub = await prisma.subscription.findFirst({
      where: {
        restaurantId,
        planId: plan.id,
        endDate: { gte: new Date() },
      },
    });

    let subscription;

    if (existingSub) {
      // تمديد أو إعادة تفعيل الاشتراك الحالي
      const newEndDate = new Date(existingSub.endDate);
      newEndDate.setMonth(newEndDate.getMonth() + plan.duration);

      subscription = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          endDate: newEndDate,
          status: 'ACTIVE', // إعادة تفعيل حتى لو كان منتهي/ملغي
          paymentStatus: 'paid',
        },
        include: {
          restaurant: { include: { owner: true } },
          plan: true,
        },
      });
    } else {
      // إنشاء اشتراك جديد
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.duration);

      subscription = await prisma.subscription.create({
        data: {
          restaurantId,
          planId: plan.id,
          startDate: new Date(),
          endDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
        },
        include: {
          restaurant: { include: { owner: true } },
          plan: true,
        },
      });
    }

    // تحديث حالة المطعم
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isSubscriptionActive: true,
        isActive: true,
      },
    });

    return successResponse(res, 'Subscription activated/extended successfully', subscription);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
