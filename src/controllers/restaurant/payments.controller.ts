import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/payments:
 *   get:
 *     summary: Get restaurant payments with filtering and pagination
 *     description: Get payments for the authenticated restaurant owner (restaurantId extracted from token)
 *     tags: [Restaurant Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [balance, stars_meal, stars_drink]
 *         description: Payment type filter
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           restaurantId:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           paymentType:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               fullName:
 *                                 type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *                         totalItems:
 *                           type: number
 *                         itemsPerPage:
 *                           type: number
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
export const getRestaurantPayments = async (req: Request, res: Response) => {
  try {
    // Get restaurantId from the authenticated user (set by verifyRestaurantOwnership middleware)
    const restaurantId = (req as any).restaurantId;
    const { page = 1, limit = 10, startDate, endDate, paymentType } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      restaurantId: restaurantId,
    };

    // Add date filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // Add payment type filtering
    if (paymentType && paymentType !== 'all') {
      where.paymentType = paymentType;
    }

    // Get payments with user information
    const [payments, totalCount] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.purchase.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      message: 'Payments retrieved successfully',
      data: {
        payments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching restaurant payments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/payments/stats:
 *   get:
 *     summary: Get restaurant payment statistics
 *     description: Get payment statistics for the authenticated restaurant owner (restaurantId extracted from token)
 *     tags: [Restaurant Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Payment statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPayments:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                     balancePayments:
 *                       type: number
 *                     starsMealPayments:
 *                       type: number
 *                     starsDrinkPayments:
 *                       type: number
 *                     uniqueCustomers:
 *                       type: number
 *                     paymentsToday:
 *                       type: number
 *                     paymentsThisWeek:
 *                       type: number
 *                     paymentsThisMonth:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
export const getRestaurantPaymentStats = async (req: Request, res: Response) => {
  try {
    // Get restaurantId from the authenticated user (set by verifyRestaurantOwnership middleware)
    const restaurantId = (req as any).restaurantId;
    const { startDate, endDate } = req.query;

    // Build where clause
    const where: any = {
      restaurantId: restaurantId,
    };

    // Add date filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // Get basic stats
    const [
      totalPayments,
      totalAmount,
      balancePayments,
      starsMealPayments,
      starsDrinkPayments,
      uniqueCustomers,
    ] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.purchase.count({
        where: { ...where, paymentType: 'balance' },
      }),
      prisma.purchase.count({
        where: { ...where, paymentType: 'stars_meal' },
      }),
      prisma.purchase.count({
        where: { ...where, paymentType: 'stars_drink' },
      }),
      prisma.purchase
        .groupBy({
          by: ['userId'],
          where,
          _count: { userId: true },
        })
        .then((result) => result.length),
    ]);

    // Get time-based stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);

    const [paymentsToday, paymentsThisWeek, paymentsThisMonth] = await Promise.all([
      prisma.purchase.count({
        where: { ...where, createdAt: { gte: today } },
      }),
      prisma.purchase.count({
        where: { ...where, createdAt: { gte: thisWeek } },
      }),
      prisma.purchase.count({
        where: { ...where, createdAt: { gte: thisMonth } },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment statistics retrieved successfully',
      data: {
        totalPayments,
        totalAmount: totalAmount._sum.amount || 0,
        balancePayments,
        starsMealPayments,
        starsDrinkPayments,
        uniqueCustomers,
        paymentsToday,
        paymentsThisWeek,
        paymentsThisMonth,
      },
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
