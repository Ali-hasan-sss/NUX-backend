import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Admin Invoices
 *     description: Admin invoices management endpoints
 */

/**
 * @swagger
 * /api/admin/invoices:
 *   get:
 *     summary: Get all invoices with optional filters, pagination, and search
 *     tags: [Admin Invoices]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by restaurant name or invoice ID
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         description: Filter by restaurant ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by invoice status (PENDING, PAID, UNPAID, CANCELLED, FAILED)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter invoices from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter invoices until this date (YYYY-MM-DD)
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
 *         description: Invoices retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const { search, restaurantId, status, startDate, endDate, page = 1, pageSize = 10 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where: any = {};

    if (restaurantId) {
      where.restaurantId = restaurantId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { stripeInvoiceId: { contains: search as string, mode: 'insensitive' } },
        {
          restaurant: {
            name: { contains: search as string, mode: 'insensitive' },
          },
        },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              address: true,
              owner: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  currency: true,
                },
              },
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              method: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSizeNum,
      }),
      prisma.invoice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    return successResponse(res, 'Invoices retrieved successfully', {
      invoices,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: pageSizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return errorResponse(res, 'Failed to fetch invoices', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices/{id}:
 *   get:
 *     summary: Get a specific invoice by ID
 *     tags: [Admin Invoices]
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
 *       500:
 *         description: Server error
 */
export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 'Invoice ID is required', 400);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
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
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            transactionId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    return successResponse(res, 'Invoice retrieved successfully', { invoice });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return errorResponse(res, 'Failed to fetch invoice', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices:
 *   post:
 *     summary: Create a new invoice for a restaurant
 *     tags: [Admin Invoices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId, amountDue, currency]
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *               subscriptionId:
 *                 type: number
 *                 description: Subscription ID (optional)
 *               amountDue:
 *                 type: number
 *                 description: Amount due
 *               amountPaid:
 *                 type: number
 *                 description: Amount paid (optional)
 *               currency:
 *                 type: string
 *                 description: Currency code (e.g., EUR, USD)
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, UNPAID, CANCELLED, FAILED]
 *                 default: PENDING
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method (e.g., CASH, CARD (VISA), CARD (MASTERCARD))
 *               periodStart:
 *                 type: string
 *                 format: date
 *                 description: Period start date
 *               periodEnd:
 *                 type: string
 *                 format: date
 *                 description: Period end date
 *               description:
 *                 type: string
 *                 description: Invoice description
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Invalid data
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const {
      restaurantId,
      subscriptionId,
      amountDue,
      amountPaid = 0,
      currency = 'EUR',
      status = 'PENDING',
      paymentMethod = 'CASH',
      periodStart,
      periodEnd,
      description,
    } = req.body;

    if (!restaurantId || !amountDue) {
      return errorResponse(res, 'restaurantId and amountDue are required', 400);
    }

    // Check if restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    // Check if subscription exists (if provided)
    if (subscriptionId) {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription) {
        return errorResponse(res, 'Subscription not found', 404);
      }
    }

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        restaurantId,
        subscriptionId: subscriptionId || null,
        stripeInvoiceId: `manual_${Date.now()}`,
        amountDue,
        amountPaid,
        currency: currency.toUpperCase(),
        status,
        paymentMethod,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            plan: {
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    return successResponse(res, 'Invoice created successfully', { invoice }, 201);
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return errorResponse(res, 'Failed to create invoice', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices/{id}:
 *   put:
 *     summary: Update an existing invoice
 *     tags: [Admin Invoices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amountDue:
 *                 type: number
 *               amountPaid:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, UNPAID, CANCELLED, FAILED]
 *               paymentMethod:
 *                 type: string
 *               periodStart:
 *                 type: string
 *                 format: date
 *               periodEnd:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Invoice updated successfully
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return errorResponse(res, 'Invoice ID is required', 400);
    }

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Prepare update data
    const dataToUpdate: any = {};

    if (updateData.amountDue !== undefined) dataToUpdate.amountDue = updateData.amountDue;
    if (updateData.amountPaid !== undefined) dataToUpdate.amountPaid = updateData.amountPaid;
    if (updateData.status) dataToUpdate.status = updateData.status;
    if (updateData.paymentMethod) dataToUpdate.paymentMethod = updateData.paymentMethod;
    if (updateData.periodStart) dataToUpdate.periodStart = new Date(updateData.periodStart);
    if (updateData.periodEnd) dataToUpdate.periodEnd = new Date(updateData.periodEnd);

    const invoice = await prisma.invoice.update({
      where: { id },
      data: dataToUpdate,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            plan: {
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    return successResponse(res, 'Invoice updated successfully', { invoice });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return errorResponse(res, 'Failed to update invoice', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices/{id}:
 *   delete:
 *     summary: Delete an invoice
 *     tags: [Admin Invoices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice deleted successfully
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 'Invoice ID is required', 400);
    }

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Delete invoice
    await prisma.invoice.delete({
      where: { id },
    });

    return successResponse(res, 'Invoice deleted successfully');
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return errorResponse(res, 'Failed to delete invoice', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices/{id}/mark-paid:
 *   patch:
 *     summary: Mark an invoice as paid
 *     tags: [Admin Invoices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method used
 *               amountPaid:
 *                 type: number
 *                 description: Amount actually paid
 *     responses:
 *       200:
 *         description: Invoice marked as paid
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
export const markInvoiceAsPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod = 'CASH', amountPaid } = req.body;

    if (!id) {
      return errorResponse(res, 'Invoice ID is required', 400);
    }

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentMethod,
        amountPaid: amountPaid || existingInvoice.amountDue,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            plan: {
              select: {
                id: true,
                title: true,
                price: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    return successResponse(res, 'Invoice marked as paid successfully', { invoice });
  } catch (error: any) {
    console.error('Error marking invoice as paid:', error);
    return errorResponse(res, 'Failed to mark invoice as paid', 500);
  }
};

/**
 * @swagger
 * /api/admin/invoices/statistics:
 *   get:
 *     summary: Get invoice statistics
 *     tags: [Admin Invoices]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Server error
 */
export const getInvoiceStatistics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      unpaidInvoices,
      totalRevenue,
      paidRevenue,
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.count({ where: { ...where, status: 'PAID' } }),
      prisma.invoice.count({ where: { ...where, status: 'PENDING' } }),
      prisma.invoice.count({ where: { ...where, status: 'UNPAID' } }),
      prisma.invoice.aggregate({
        where,
        _sum: { amountDue: true },
      }),
      prisma.invoice.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { amountPaid: true },
      }),
    ]);

    const statistics = {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      unpaidInvoices,
      totalRevenue: totalRevenue._sum.amountDue || 0,
      paidRevenue: paidRevenue._sum.amountPaid || 0,
      pendingRevenue: (totalRevenue._sum.amountDue || 0) - (paidRevenue._sum.amountPaid || 0),
      paidPercentage: totalInvoices > 0 ? ((paidInvoices / totalInvoices) * 100).toFixed(2) : 0,
    };

    return successResponse(res, 'Statistics retrieved successfully', { statistics });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return errorResponse(res, 'Failed to fetch statistics', 500);
  }
};
