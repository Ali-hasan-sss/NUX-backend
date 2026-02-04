// src/controllers/restaurant/orders.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitToRestaurant } from '../../services/socket.service';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/orders:
 *   get:
 *     summary: Get all orders for the authenticated restaurant
 *     tags: [Restaurant Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, PREPARING, READY, COMPLETED, CANCELLED]
 *         description: Filter orders by status
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved orders
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const { status, page = 1, pageSize = 10 } = req.query;
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {
      restaurantId: restaurant.id,
    };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          table: {
            select: {
              id: true,
              number: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSizeNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/orders/{orderId}:
 *   get:
 *     summary: Get a specific order by ID
 *     tags: [Restaurant Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Successfully retrieved order
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderIdNum,
        restaurantId: restaurant.id,
      },
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/orders/{orderId}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Restaurant Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, CONFIRMED, PREPARING, READY, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderIdNum,
        restaurantId: restaurant.id,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderIdNum },
      data: { status },
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            name: true,
          },
        },
      },
    });

    // Emit order status update via WebSocket for real-time sync
    emitToRestaurant(restaurant.id, 'order:status', updatedOrder);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
