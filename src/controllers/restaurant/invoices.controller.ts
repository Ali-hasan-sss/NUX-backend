import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { assertOwnerOrAdmin } from '../../utils/check_restauran-owner';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Restaurant invoices management
 */

/**
 * @swagger
 * /restaurants/invoices:
 *   get:
 *     summary: Get restaurant invoices
 *     description: Get all invoices for the authenticated restaurant
 *     tags: [Invoices]
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
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getRestaurantInvoices = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const check = await assertOwnerOrAdmin(userId, restaurant.id);
    if (!check.ok) return errorResponse(res, check.msg, check.code);

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { restaurantId: restaurant.id },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              address: true,
              logo: true,
            },
          },
          subscription: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              plan: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  currency: true,
                  duration: true,
                },
              },
            },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({
        where: { restaurantId: restaurant.id },
      }),
    ]);

    return successResponse(res, 'Invoices retrieved successfully', {
      invoices,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error('Error fetching invoices:', err);
    return errorResponse(res, 'Failed to fetch invoices', 500);
  }
};

/**
 * @swagger
 * /restaurants/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     description: Get a specific invoice for the authenticated restaurant
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'User not found', 401);

    const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const check = await assertOwnerOrAdmin(userId, restaurant.id);
    if (!check.ok) return errorResponse(res, check.msg, check.code);

    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: id as string,
        restaurantId: restaurant.id,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            logo: true,
          },
        },
        subscription: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            plan: {
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
                duration: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    return successResponse(res, 'Invoice retrieved successfully', invoice);
  } catch (err: any) {
    console.error('Error fetching invoice:', err);
    return errorResponse(res, 'Failed to fetch invoice', 500);
  }
};
