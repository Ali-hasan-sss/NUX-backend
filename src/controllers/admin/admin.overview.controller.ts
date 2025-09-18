import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /admin/overview:
 *   get:
 *     summary: Get admin dashboard overview statistics
 *     description: Retrieve comprehensive statistics and recent activities for the admin dashboard
 *     tags: [Admin Overview]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Admin overview retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       description: Total number of users in the system
 *                       example: 150
 *                     totalRestaurants:
 *                       type: integer
 *                       description: Total number of restaurants
 *                       example: 25
 *                     activeSubscriptions:
 *                       type: integer
 *                       description: Number of active subscriptions
 *                       example: 20
 *                     expiredSubscriptions:
 *                       type: integer
 *                       description: Number of expired subscriptions
 *                       example: 5
 *                     totalRevenue:
 *                       type: number
 *                       description: Total revenue from paid invoices
 *                       example: 5000.00
 *                     newSignupsThisWeek:
 *                       type: integer
 *                       description: New user signups in the last 7 days
 *                       example: 12
 *                     newRestaurantsThisWeek:
 *                       type: integer
 *                       description: New restaurant registrations in the last 7 days
 *                       example: 3
 *                     subscriptionHealth:
 *                       type: number
 *                       description: Percentage of active subscriptions
 *                       example: 80.0
 *                     recentActivities:
 *                       type: array
 *                       description: Recent activities across the platform
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "sub-123"
 *                           type:
 *                             type: string
 *                             enum: [subscription, restaurant, invoice]
 *                             example: "subscription"
 *                           message:
 *                             type: string
 *                             example: "New subscription: Restaurant ABC subscribed to Pro Plan"
 *                           time:
 *                             type: string
 *                             example: "2 hours ago"
 *                           status:
 *                             type: string
 *                             enum: [success, warning, info, error]
 *                             example: "success"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch admin overview"
 */
export const getAdminOverview = async (req: Request, res: Response) => {
  try {
    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get total restaurants count
    const totalRestaurants = await prisma.restaurant.count();

    // Get active subscriptions count
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    });

    // Get expired subscriptions count
    const expiredSubscriptions = await prisma.subscription.count({
      where: {
        status: 'EXPIRED',
      },
    });

    // Get total revenue from paid invoices
    const revenueResult = await prisma.invoice.aggregate({
      where: {
        status: 'PAID',
      },
      _sum: {
        amountPaid: true,
      },
    });

    const totalRevenue = revenueResult._sum.amountPaid || 0;

    // Get new signups this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newSignupsThisWeek = await prisma.user.count({
      where: {
        createdAt: {
          gte: oneWeekAgo,
        },
      },
    });

    // Get new restaurants this week
    const newRestaurantsThisWeek = await prisma.restaurant.count({
      where: {
        createdAt: {
          gte: oneWeekAgo,
        },
      },
    });

    // Calculate subscription health percentage
    const totalSubscriptions = await prisma.subscription.count();
    const subscriptionHealth =
      totalSubscriptions > 0
        ? ((activeSubscriptions / totalSubscriptions) * 100).toFixed(1)
        : '0.0';

    // Get recent activity (last 10 activities)
    const recentActivities = await getRecentActivities();

    const overview = {
      totalUsers,
      totalRestaurants,
      activeSubscriptions,
      expiredSubscriptions,
      totalRevenue,
      newSignupsThisWeek,
      newRestaurantsThisWeek,
      subscriptionHealth: parseFloat(subscriptionHealth),
      recentActivities,
    };

    return successResponse(res, 'Admin overview retrieved successfully', overview);
  } catch (error: any) {
    console.error('Error fetching admin overview:', error);
    return errorResponse(res, 'Failed to fetch admin overview', 500);
  }
};

// Helper function to get recent activities
async function getRecentActivities() {
  try {
    // Get recent subscriptions
    const recentSubscriptions = await prisma.subscription.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        restaurant: {
          select: {
            name: true,
          },
        },
        plan: {
          select: {
            title: true,
          },
        },
      },
    });

    // Get recent restaurants
    const recentRestaurants = await prisma.restaurant.findMany({
      take: 3,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 2,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        restaurant: {
          select: {
            name: true,
          },
        },
      },
    });

    const activities: any[] = [];

    // Process subscription activities
    recentSubscriptions.forEach((subscription) => {
      const timeAgo = getTimeAgo(subscription.createdAt);
      activities.push({
        id: `sub-${subscription.id}`,
        type: 'subscription',
        message: `New subscription: ${subscription.restaurant.name} subscribed to ${subscription.plan.title}`,
        time: timeAgo,
        status: subscription.status === 'ACTIVE' ? 'success' : 'warning',
        createdAt: subscription.createdAt,
      });
    });

    // Process restaurant activities
    recentRestaurants.forEach((restaurant) => {
      const timeAgo = getTimeAgo(restaurant.createdAt);
      activities.push({
        id: `rest-${restaurant.id}`,
        type: 'restaurant',
        message: `New restaurant registered: ${restaurant.name} by ${restaurant.owner.fullName}`,
        time: timeAgo,
        status: 'info',
        createdAt: restaurant.createdAt,
      });
    });

    // Process invoice activities
    recentInvoices.forEach((invoice) => {
      const timeAgo = getTimeAgo(invoice.createdAt);
      activities.push({
        id: `inv-${invoice.id}`,
        type: 'invoice',
        message: `Invoice ${invoice.status.toLowerCase()}: ${invoice.restaurant.name} - ${invoice.amountDue} ${invoice.currency}`,
        time: timeAgo,
        status: invoice.status === 'PAID' ? 'success' : 'warning',
        createdAt: invoice.createdAt,
      });
    });

    // Sort by creation date and return top 10
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
}
