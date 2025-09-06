import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/restaurants/account/update:
 *   put:
 *     summary: Update own restaurant
 *     tags: [Restaurant account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logo:
 *                 type: string
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *       404:
 *         description: Restaurant not found
 */
export const updateRestaurantByOwner = async (req: Request, res: Response) => {
  try {
    const { name, address, latitude, longitude, logo } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId: req.user!.id },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: name ?? restaurant.name,
        address: address ?? restaurant.address,
        latitude: latitude ?? restaurant.latitude,
        longitude: longitude ?? restaurant.longitude,
        logo: logo ?? restaurant.logo,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        plan: true,
        isGroupMember: true,
        qrCode_drink: true,
        qrCode_meal: true,
        subscriptionActive: true,
        subscriptionExpiry: true,
        createdAt: true,
      },
    });

    return successResponse(res, 'Restaurant updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
