import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { assertOwnerOrAdmin } from '../../utils/check_restauran-owner';
import { sendNotificationToUser } from '../../services/notification.service';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Packages
 *     description: CRUD operations for restaurant packages
 */

/**
 * @swagger
 * /restaurants/packages:
 *   get:
 *     summary: Get list of packages for a restaurant
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Packages fetched successfully }
 *       404: { description: Restaurant not found }
 */
export const listPackages = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return errorResponse(res, 'user not found', 404);

  const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
  if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

  const restaurantId = restaurant.id;

  if (!restaurantId) return errorResponse(res, 'Restaurant ID is required', 400);

  const check = userId ? await assertOwnerOrAdmin(userId, restaurantId) : { ok: false };

  const whereForPublic = check.ok
    ? { restaurantId } // Owner or admin sees all packages
    : { restaurantId, isActive: true, isPublic: true }; // Public users see only active public packages

  const items = await prisma.topUpPackage.findMany({
    where: whereForPublic,
    orderBy: { createdAt: 'desc' },
  });

  return successResponse(res, 'Packages fetched', items);
};

/**
 * @swagger
 * /restaurants/{restaurantId}/packages:
 *   post:
 *     summary: Create a new package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, amount]
 *             properties:
 *               name: { type: string, example: "€50 + €5 bonus" }
 *               amount: { type: number, example: 50 }
 *               bonus: { type: number, example: 5 }
 *               currency: { type: string, example: "EUR" }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               isPublic: { type: boolean }
 *     responses:
 *       201: { description: Package created successfully }
 *       403: { description: Forbidden }
 *       409: { description: Package name already exists for this restaurant }
 */
export const createPackage = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
  if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

  const restaurantId = restaurant.id;

  if (!restaurantId) return errorResponse(res, 'Restaurant ID is required', 400);

  const check = await assertOwnerOrAdmin(userId, restaurantId);
  if (!check.ok) return errorResponse(res, check.msg, check.code);

  const {
    name,
    amount,
    bonus = 0,
    currency = 'EUR',
    description,
    isActive = true,
    isPublic = true,
  } = req.body;

  // Check current package count (maximum 5)
  const packageCount = await prisma.topUpPackage.count({ where: { restaurantId } });
  if (packageCount >= 5) {
    return errorResponse(
      res,
      'Cannot create more than 5 packages. Delete an existing package first.',
      400,
    );
  }

  // Prevent duplicate package name for the same restaurant
  const exists = await prisma.topUpPackage.findFirst({
    where: { restaurantId, name },
    select: { id: true },
  });
  if (exists) return errorResponse(res, 'Package name already exists for this restaurant', 409);

  const created = await prisma.topUpPackage.create({
    data: { restaurantId, name, amount, bonus, currency, description, isActive, isPublic },
  });

  return successResponse(res, 'Package created', created, 201);
};

/**
 * @swagger
 * /restaurants/packages/{id}:
 *   get:
 *     summary: Get a specific package by ID
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     responses:
 *       200: { description: Package fetched successfully }
 *       404: { description: Package not found }
 */
export const getPackageById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
  if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

  const restaurantId = restaurant.id;

  if (!restaurantId) return errorResponse(res, 'Restaurant ID is required', 400);
  if (!id) return errorResponse(res, 'Package ID is required', 400);

  const packageId = parseInt(id, 10);
  if (isNaN(packageId)) return errorResponse(res, 'Invalid Package ID', 400);

  const pkg = await prisma.topUpPackage.findFirst({ where: { id: packageId, restaurantId } });
  if (!pkg) return errorResponse(res, 'Package not found', 404);

  // Only owner/admin can access inactive or private packages
  if (!(pkg.isActive && pkg.isPublic)) {
    if (!userId) return errorResponse(res, 'Forbidden', 403);
    const check = await assertOwnerOrAdmin(userId, restaurantId);
    if (!check.ok) return errorResponse(res, 'Forbidden', 403);
  }

  return successResponse(res, 'Package fetched', pkg);
};

/**
 * @swagger
 * /restaurants/packages/{id}:
 *   put:
 *     summary: Update a package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               amount: { type: number }
 *               bonus: { type: number }
 *               currency: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               isPublic: { type: boolean }
 *     responses:
 *       200: { description: Package updated successfully }
 *       403: { description: Forbidden }
 *       404: { description: Package not found }
 *       409: { description: Duplicate package name }
 */
export const updatePackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
  if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

  const restaurantId = restaurant.id;

  if (!restaurantId) return errorResponse(res, 'Restaurant ID is required', 400);
  if (!id) return errorResponse(res, 'Package ID is required', 400);

  const check = await assertOwnerOrAdmin(userId, restaurantId);
  if (!check.ok) return errorResponse(res, check.msg, check.code);

  const packageId = parseInt(id, 10);
  if (isNaN(packageId)) return errorResponse(res, 'Invalid Package ID', 400);

  const pkg = await prisma.topUpPackage.findFirst({ where: { id: packageId, restaurantId } });
  if (!pkg) return errorResponse(res, 'Package not found', 404);

  const { name } = req.body;
  if (name && name !== pkg.name) {
    const duplicate = await prisma.topUpPackage.findFirst({
      where: { restaurantId, name },
      select: { id: true },
    });
    if (duplicate)
      return errorResponse(res, 'Package name already exists for this restaurant', 409);
  }

  const updated = await prisma.topUpPackage.update({
    where: { id: packageId },
    data: req.body,
  });

  return successResponse(res, 'Package updated', updated);
};

/**
 * @swagger
 * /restaurants/packages/{id}:
 *   delete:
 *     summary: Delete a package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     responses:
 *       200: { description: Package deleted successfully }
 *       403: { description: Forbidden }
 *       404: { description: Package not found }
 */
export const deletePackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const restaurant = await prisma.restaurant.findFirst({ where: { userId } });
  if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

  const restaurantId = restaurant.id;

  if (!restaurantId) return errorResponse(res, 'Restaurant ID is required', 400);
  if (!id) return errorResponse(res, 'Package ID is required', 400);

  const packageId = parseInt(id, 10);
  if (isNaN(packageId)) return errorResponse(res, 'Invalid Package ID', 400);

  const check = await assertOwnerOrAdmin(userId, restaurantId);
  if (!check.ok) return errorResponse(res, check.msg, check.code);

  const pkg = await prisma.topUpPackage.findFirst({ where: { id: packageId, restaurantId } });
  if (!pkg) return errorResponse(res, 'Package not found', 404);

  await prisma.topUpPackage.delete({ where: { id: packageId } });
  return successResponse(res, 'Package deleted', null);
};

/**
 * @swagger
 * /api/restaurant/balance/topup:
 *   post:
 *     summary: Restaurant scans user QR and tops up balance
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userQr
 *               - packageId
 *             properties:
 *               userQr:
 *                 type: string
 *                 example: "USER_QR_CODE_123"
 *               packageId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Balance topped up successfully
 *       400:
 *         description: Invalid input or QR code
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const topUpUserBalanceByRestaurant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const restaurant = await prisma.restaurant.findFirst({
      where: { userId },
      select: { id: true, name: true },
    });

    if (!restaurant) {
      return res.status(404).json({ message: 'restaurant not found' });
    }

    const restaurantId = restaurant.id;
    const restaurantName = restaurant.name;

    const { userQr, packageId } = req.body;
    if (!userQr || !packageId) {
      return errorResponse(res, 'userQr and packageId are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { qrCode: userQr } });
    if (!user) {
      return errorResponse(res, 'Invalid user QR code', 400);
    }

    const topUpPackage = await prisma.topUpPackage.findUnique({ where: { id: Number(packageId) } });
    if (!topUpPackage || topUpPackage.restaurantId !== restaurantId) {
      return errorResponse(res, 'Invalid package for this restaurant', 400);
    }

    const totalBalance = topUpPackage.amount + topUpPackage.bonus;

    let balance = await prisma.userRestaurantBalance.findUnique({
      where: {
        userId_restaurantId: {
          userId: user.id,
          restaurantId: restaurantId,
        },
      },
    });

    if (!balance) {
      balance = await prisma.userRestaurantBalance.create({
        data: {
          userId: user.id,
          restaurantId,
          balance: totalBalance,
        },
      });
    } else {
      balance = await prisma.userRestaurantBalance.update({
        where: { id: balance.id },
        data: { balance: balance.balance + totalBalance },
      });
    }

    await prisma.topUp.create({
      data: {
        userId: user.id,
        restaurantId,
        amount: topUpPackage.amount,
        bonus: topUpPackage.bonus,
        totalBalanceAdded: totalBalance,
        method: 'QR_SCAN',
        planId: topUpPackage.id,
      },
    });

    await sendNotificationToUser({
      userId: user.id,
      title: 'Top-Up Successful',
      body: `Your balance at ${restaurantName} has been topped up by €${totalBalance}`,
      type: 'TOPUP',
    });

    return successResponse(res, 'Balance topped up successfully', balance);
  } catch (error) {
    console.error('Top-up error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
