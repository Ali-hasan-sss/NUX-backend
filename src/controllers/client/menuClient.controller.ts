// src/controllers/menuCustomer.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /customer/menu/{qrCode}:
 *   get:
 *     summary: Get all menu categories of a restaurant by QR code (restaurant ID)
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the restaurant from QR code
 *     responses:
 *       200:
 *         description: Successfully retrieved categories
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
// controller
export const getCategoriesByQRCode = async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.params; // هذا الـ qrCode فعليًا هو restaurantId

    if (!qrCode) return res.status(400).json({ success: false, message: 'QR code is required' });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: qrCode }, // id هو String
      select: { id: true, name: true, logo: true },
    });

    if (!restaurant)
      return res.status(404).json({ success: false, message: 'Restaurant not found' });

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id },
    });

    res.json({
      success: true,
      data: categories,
      restaurant: { name: restaurant.name ?? null, logo: restaurant.logo ?? null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /customer/menu/items/{categoryId}:
 *   get:
 *     summary: Get all menu items for a specific category by categoryId
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to fetch items
 *     responses:
 *       200:
 *         description: Successfully retrieved menu items
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const getItemsByCategoryForCustomer = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId)
      return res.status(400).json({ success: false, message: 'Category ID is required' });

    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: {
        items: {
          include: {
            kitchenSection: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    res.json({ success: true, data: category.items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
