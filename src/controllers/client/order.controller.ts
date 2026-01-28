// src/controllers/client/order.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /customer/orders:
 *   post:
 *     summary: Create a new order from customer cart
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - items
 *               - totalPrice
 *             properties:
 *               restaurantId:
 *                 type: string
 *               tableNumber:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: number
 *                     quantity:
 *                       type: integer
 *                     selectedExtras:
 *                       type: array
 *                     notes:
 *                       type: string
 *               totalPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { restaurantId, tableNumber, items, totalPrice, orderType } = req.body;

    if (!restaurantId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID and items are required',
      });
    }

    if (!totalPrice || totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total price must be greater than 0',
      });
    }

    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    // Find table if tableNumber is provided
    let tableId: number | null = null;
    if (tableNumber) {
      const table = await prisma.table.findFirst({
        where: {
          restaurantId: restaurantId,
          number: parseInt(tableNumber),
        },
      });
      if (table) {
        tableId = table.id;
      }
    }

    const validOrderTypes = ['ON_TABLE', 'TAKE_AWAY'];
    const orderTypeValue =
      orderType && validOrderTypes.includes(orderType) ? orderType : 'ON_TABLE';

    // Create order with items
    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableId,
        tableNumber: tableNumber ? parseInt(tableNumber) : null,
        orderType: orderTypeValue,
        totalPrice: parseFloat(totalPrice),
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            menuItemId: item.id || null,
            itemTitle: item.title,
            itemDescription: item.description || null,
            itemImage: item.image || null,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice:
              (item.price +
                (item.selectedExtras?.reduce(
                  (sum: number, extra: any) => sum + (extra.price || 0),
                  0
                ) || 0)) *
              item.quantity,
            selectedExtras: item.selectedExtras || null,
            notes: item.notes || null,
            preparationTime: item.preparationTime || null,
            baseCalories: item.baseCalories || null,
            allergies: item.allergies || [],
            kitchenSection: item.kitchenSection?.name || null,
          })),
        },
      },
      include: {
        items: true,
        table: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
