import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/overview:
 *   get:
 *     summary: Get restaurant dashboard overview statistics
 *     description: Retrieve comprehensive statistics and recent activities for a specific restaurant's dashboard
 *     tags: [Restaurant Overview]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant overview retrieved successfully
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
 *                   example: "Restaurant overview retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     restaurant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "rest-123"
 *                         name:
 *                           type: string
 *                           example: "Restaurant ABC"
 *                         address:
 *                           type: string
 *                           example: "123 Main St, City"
 *                         isActive:
 *                           type: boolean
 *                           example: true
 *                         isSubscriptionActive:
 *                           type: boolean
 *                           example: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00Z"
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalQRScans:
 *                           type: integer
 *                           description: Total number of QR code scans
 *                           example: 1250
 *                         thisMonthScans:
 *                           type: integer
 *                           description: QR scans this month
 *                           example: 150
 *                         scanGrowthPercentage:
 *                           type: number
 *                           description: Growth percentage compared to last month
 *                           example: 12.5
 *                         loyaltyPointsIssued:
 *                           type: integer
 *                           description: Total loyalty points issued to customers
 *                           example: 3500
 *                         groupMembers:
 *                           type: integer
 *                           description: Number of group memberships
 *                           example: 15
 *                         monthlyRevenue:
 *                           type: number
 *                           description: Revenue for current month
 *                           example: 2500.00
 *                         revenueGrowthPercentage:
 *                           type: number
 *                           description: Revenue growth percentage compared to last month
 *                           example: 8.3
 *                         activeCustomers:
 *                           type: integer
 *                           description: Number of customers who scanned QR codes
 *                           example: 45
 *                         averageRating:
 *                           type: number
 *                           description: Average customer rating
 *                           example: 4.8
 *                     recentActivities:
 *                       type: array
 *                       description: Recent activities for this restaurant
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "scan-123"
 *                           type:
 *                             type: string
 *                             enum: [qr_scan, group_invite, payment, customer]
 *                             example: "qr_scan"
 *                           message:
 *                             type: string
 *                             example: "Customer John Doe scanned QR code - drink scan"
 *                           time:
 *                             type: string
 *                             example: "2 hours ago"
 *                           points:
 *                             type: integer
 *                             description: Loyalty points awarded (for qr_scan activities)
 *                             example: 10
 *                           amount:
 *                             type: number
 *                             description: Purchase amount (for payment activities)
 *                             example: 25.50
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Bad request - User ID not found
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
 *                   example: "User ID not found"
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
 *         description: Forbidden - Restaurant owner access required
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
 *       404:
 *         description: Restaurant not found
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
 *                   example: "Restaurant not found for this user"
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
 *                   example: "Failed to fetch restaurant overview"
 */
export const getRestaurantOverview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return errorResponse(res, 'User ID not found', 400);
    }

    // Get restaurant ID from user
    const restaurantRecord = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantRecord) {
      return errorResponse(res, 'Restaurant not found for this user', 404);
    }

    const restaurantId = restaurantRecord.id;

    // Get restaurant basic info
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        isActive: true,
        isSubscriptionActive: true,
      },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    // Get QR code scan statistics
    const totalQRScans = await prisma.scanLog.count({
      where: { restaurantId },
    });

    const thisMonthScans = await prisma.scanLog.count({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    const lastMonthScans = await prisma.scanLog.count({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    // Get loyalty points statistics
    const loyaltyPointsIssued = await prisma.starsTransaction.aggregate({
      where: { restaurantId },
      _sum: {
        stars_drink: true,
        stars_meal: true,
      },
    });

    const totalLoyaltyPoints =
      (loyaltyPointsIssued._sum.stars_drink || 0) + (loyaltyPointsIssued._sum.stars_meal || 0);

    // Get group members count
    const groupMembers = await prisma.groupMembership.count({
      where: { restaurantId },
    });

    // Get monthly revenue from purchases
    const thisMonthRevenue = await prisma.purchase.aggregate({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { amount: true },
    });

    const lastMonthRevenue = await prisma.purchase.aggregate({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { amount: true },
    });

    // Get active customers (users who have scanned QR codes)
    const activeCustomers = await prisma.scanLog.findMany({
      where: { restaurantId },
      select: { userId: true },
      distinct: ['userId'],
    });

    // Get average rating (mock data for now - you can implement rating system later)
    const averageRating = 4.8;

    // Calculate growth percentages
    const scanGrowthPercentage =
      lastMonthScans > 0
        ? (((thisMonthScans - lastMonthScans) / lastMonthScans) * 100).toFixed(1)
        : '0.0';

    const revenueGrowthPercentage =
      lastMonthRevenue._sum.amount && lastMonthRevenue._sum.amount > 0
        ? (
            (((thisMonthRevenue._sum.amount || 0) - lastMonthRevenue._sum.amount) /
              lastMonthRevenue._sum.amount) *
            100
          ).toFixed(1)
        : '0.0';

    // Get recent activities
    const recentActivities = await getRecentActivities(restaurantId);

    const overview = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        isActive: restaurant.isActive,
        isSubscriptionActive: restaurant.isSubscriptionActive,
        createdAt: restaurant.createdAt,
      },
      stats: {
        totalQRScans,
        thisMonthScans,
        scanGrowthPercentage: parseFloat(scanGrowthPercentage),
        loyaltyPointsIssued: totalLoyaltyPoints,
        groupMembers,
        monthlyRevenue: thisMonthRevenue._sum.amount || 0,
        revenueGrowthPercentage: parseFloat(revenueGrowthPercentage),
        activeCustomers: activeCustomers.length,
        averageRating,
      },
      recentActivities,
    };

    return successResponse(res, 'Restaurant overview retrieved successfully', overview);
  } catch (error: any) {
    console.error('Error fetching restaurant overview:', error);
    return errorResponse(res, 'Failed to fetch restaurant overview', 500);
  }
};

const getRecentActivities = async (restaurantId: string) => {
  try {
    const activities: any[] = [];

    // Get recent QR scans
    const recentScans = await prisma.scanLog.findMany({
      where: { restaurantId },
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { fullName: true, email: true },
        },
      },
    });

    // Get recent group activities
    const recentGroupActivities = await prisma.groupMembership.findMany({
      where: { restaurantId },
      take: 2,
      orderBy: { joinedAt: 'desc' },
      include: {
        group: {
          select: { name: true },
        },
      },
    });

    // Get recent purchases
    const recentPurchases = await prisma.purchase.findMany({
      where: { restaurantId },
      take: 2,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { fullName: true },
        },
      },
    });

    // Add scan activities
    recentScans.forEach((scan) => {
      activities.push({
        id: `scan-${scan.id}`,
        type: 'qr_scan',
        message: `Customer ${scan.user.fullName || 'Unknown'} scanned QR code - ${scan.type} scan`,
        time: getTimeAgo(scan.createdAt),
        points: scan.type === 'drink' ? 10 : 20, // Mock points
        createdAt: scan.createdAt,
      });
    });

    // Add group activities
    recentGroupActivities.forEach((membership) => {
      activities.push({
        id: `group-${membership.groupId}-${membership.restaurantId}`,
        type: 'group_invite',
        message: `Joined group: ${membership.group.name}`,
        time: getTimeAgo(membership.joinedAt),
        createdAt: membership.joinedAt,
      });
    });

    // Add purchase activities
    recentPurchases.forEach((purchase) => {
      activities.push({
        id: `purchase-${purchase.id}`,
        type: 'payment',
        message: `Purchase completed: ${purchase.user.fullName || 'Customer'} - $${purchase.amount}`,
        time: getTimeAgo(purchase.createdAt),
        amount: purchase.amount,
        createdAt: purchase.createdAt,
      });
    });

    // Sort by creation date and take the most recent 5
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
};

const getTimeAgo = (date: Date): string => {
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
};
