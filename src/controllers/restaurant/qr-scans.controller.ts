import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/qr-scans:
 *   get:
 *     summary: Get QR code scans for a restaurant
 *     description: Retrieve QR code scan logs for a specific restaurant with filtering and pagination
 *     tags: [Restaurant QR Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering scans (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering scans (YYYY-MM-DD)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [drink, meal]
 *         description: Filter by scan type
 *     responses:
 *       200:
 *         description: QR scans retrieved successfully
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
 *                   example: "QR scans retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     scans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 123
 *                           userId:
 *                             type: string
 *                             example: "user-123"
 *                           restaurantId:
 *                             type: string
 *                             example: "rest-123"
 *                           type:
 *                             type: string
 *                             enum: [drink, meal]
 *                             example: "drink"
 *                           qrCode:
 *                             type: string
 *                             example: "QR123456"
 *                           latitude:
 *                             type: number
 *                             example: 40.7128
 *                           longitude:
 *                             type: number
 *                             example: -74.0060
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "user-123"
 *                               email:
 *                                 type: string
 *                                 example: "user@example.com"
 *                               fullName:
 *                                 type: string
 *                                 example: "John Doe"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *                         totalItems:
 *                           type: integer
 *                           example: 50
 *                         itemsPerPage:
 *                           type: integer
 *                           example: 10
 *                         hasNextPage:
 *                           type: boolean
 *                           example: true
 *                         hasPrevPage:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Bad request - Invalid parameters
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Restaurant owner access required
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
export const getQRScans = async (req: Request, res: Response) => {
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

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const type = req.query.type as string;

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      restaurantId,
    };

    // Add date filtering
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to endDate to include the entire day
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        whereClause.createdAt.lt = endDateTime;
      }
    }

    // Add type filtering
    if (type && ['drink', 'meal'].includes(type)) {
      whereClause.type = type;
    }

    // Get total count for pagination
    const totalItems = await prisma.scanLog.count({
      where: whereClause,
    });

    // Get scans with pagination
    const scans = await prisma.scanLog.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
    };

    const response = {
      scans,
      pagination,
    };

    return successResponse(res, 'QR scans retrieved successfully', response);
  } catch (error: any) {
    console.error('Error fetching QR scans:', error);
    return errorResponse(res, 'Failed to fetch QR scans', 500);
  }
};

/**
 * @swagger
 * /restaurants/qr-scans/stats:
 *   get:
 *     summary: Get QR scan statistics for a restaurant
 *     description: Retrieve statistics about QR code scans for a specific restaurant
 *     tags: [Restaurant QR Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering scans (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering scans (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: QR scan statistics retrieved successfully
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
 *                   example: "QR scan statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalScans:
 *                       type: integer
 *                       example: 1250
 *                     drinkScans:
 *                       type: integer
 *                       example: 800
 *                     mealScans:
 *                       type: integer
 *                       example: 450
 *                     uniqueUsers:
 *                       type: integer
 *                       example: 150
 *                     scansToday:
 *                       type: integer
 *                       example: 25
 *                     scansThisWeek:
 *                       type: integer
 *                       example: 180
 *                     scansThisMonth:
 *                       type: integer
 *                       example: 750
 *       400:
 *         description: Bad request - Invalid parameters
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Restaurant owner access required
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
export const getQRScanStats = async (req: Request, res: Response) => {
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

    // Parse query parameters
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where clause
    const whereClause: any = {
      restaurantId,
    };

    // Add date filtering
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to endDate to include the entire day
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        whereClause.createdAt.lt = endDateTime;
      }
    }

    // Get total scans
    const totalScans = await prisma.scanLog.count({
      where: whereClause,
    });

    // Get drink scans
    const drinkScans = await prisma.scanLog.count({
      where: {
        ...whereClause,
        type: 'drink',
      },
    });

    // Get meal scans
    const mealScans = await prisma.scanLog.count({
      where: {
        ...whereClause,
        type: 'meal',
      },
    });

    // Get unique users
    const uniqueUsers = await prisma.scanLog.findMany({
      where: whereClause,
      select: { userId: true },
      distinct: ['userId'],
    });

    // Get today's scans
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scansToday = await prisma.scanLog.count({
      where: {
        restaurantId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Get this week's scans
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const scansThisWeek = await prisma.scanLog.count({
      where: {
        restaurantId,
        createdAt: {
          gte: oneWeekAgo,
        },
      },
    });

    // Get this month's scans
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const scansThisMonth = await prisma.scanLog.count({
      where: {
        restaurantId,
        createdAt: {
          gte: oneMonthAgo,
        },
      },
    });

    const stats = {
      totalScans,
      drinkScans,
      mealScans,
      uniqueUsers: uniqueUsers.length,
      scansToday,
      scansThisWeek,
      scansThisMonth,
    };

    return successResponse(res, 'QR scan statistics retrieved successfully', stats);
  } catch (error: any) {
    console.error('Error fetching QR scan statistics:', error);
    return errorResponse(res, 'Failed to fetch QR scan statistics', 500);
  }
};
