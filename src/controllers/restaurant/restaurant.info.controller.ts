import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/restaurants/account/me:
 *   get:
 *     summary: Get own restaurant
 *     tags: [Restaurant account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant fetched successfully
 *       404:
 *         description: Restaurant not found
 */
export const getRestaurantByOwner = async (req: Request, res: Response) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId: req.user!.id },
      select: {
        id: true,
        userId: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        subscriptions: true,
        isGroupMember: true,
        qrCode_drink: true,
        qrCode_meal: true,
        isSubscriptionActive: true,
        createdAt: true,
        groupMemberships: {
          select: {
            group: {
              select: {
                id: true,
                name: true,
                description: true,
                ownerId: true,
              },
            },
          },
        },
        ownedGroups: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    // Normalize group info: prefer owned group; otherwise first membership (strip ownerId)
    const owned = (restaurant as any).ownedGroups?.[0];
    const member = (restaurant as any).groupMemberships?.[0]?.group;
    const memberSanitized = member
      ? { id: member.id, name: member.name, description: member.description }
      : null;
    const groupInfo = owned
      ? { ...owned, role: 'OWNER' }
      : memberSanitized
        ? { ...memberSanitized, role: 'MEMBER' }
        : null;

    const { groupMemberships, ownedGroups, ...rest } = restaurant as any;
    return successResponse(res, 'Restaurant fetched successfully', {
      ...rest,
      group: groupInfo,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
        subscriptions: true,
        isGroupMember: true,
        qrCode_drink: true,
        qrCode_meal: true,
        isSubscriptionActive: true,
        createdAt: true,
      },
    });

    return successResponse(res, 'Restaurant updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/restaurants/account/qr/regenerate:
 *   put:
 *     summary: Regenerate restaurant QR codes (drink and meal)
 *     tags: [Restaurant account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR codes regenerated successfully
 *       404:
 *         description: Restaurant not found
 */
export const regenerateRestaurantQRCodes = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Generate globally unique QR codes using UUID v4
    const newDrinkCode = randomUUID();
    const newMealCode = randomUUID();

    const updated = await prisma.restaurant.update({
      where: { userId },
      data: {
        qrCode_drink: newDrinkCode,
        qrCode_meal: newMealCode,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        subscriptions: true,
        isGroupMember: true,
        qrCode_drink: true,
        qrCode_meal: true,
        isSubscriptionActive: true,
        createdAt: true,
      },
    });

    return successResponse(res, 'QR codes regenerated successfully', updated);
  } catch (error: any) {
    // If the restaurant does not exist for this user
    if (error?.code === 'P2025') {
      return errorResponse(res, 'Restaurant not found', 404);
    }
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
