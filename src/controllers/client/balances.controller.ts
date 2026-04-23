import { Request, Response } from 'express';
import { PrismaClient, UserRestaurantBalance } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { calculateDistance } from '../../utils/check_location';
import { sendNotificationToUser } from '../../services/notification.service';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: balance
 *     description: |
 *       Loyalty stars per restaurant (meal/drink) and QR scans.
 *       Monetary payments between user and restaurants use the Wallet API (/client/wallet), not UserRestaurantBalance.balance.
 */

/**
 * @swagger
 * /client/balance/with-restaurants:
 *   get:
 *     summary: Restaurants where the user has stars or legacy per-restaurant balance row
 *     tags: [balance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurants with balance fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getUserRestaurantsWithBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const balances = await prisma.userRestaurantBalance.findMany({
      where: {
        userId,
        OR: [{ balance: { gt: 0 } }, { stars_meal: { gt: 0 } }, { stars_drink: { gt: 0 } }],
      },
      include: {
        restaurant: {
          include: {
            groupMemberships: { include: { group: true } },
            ownedGroups: true,
          },
        },
      },
    });

    const grouped: Record<
      string,
      {
        targetId: string;
        name: string;
        stars_drink: number;
        stars_meal: number;
        balance: number;
        isGroup: boolean;
        /** Restaurant ID to use for voucher settings (restaurant id or group owner id) */
        _restaurantIdForVouchers: string;
      }
    > = {};

    for (const b of balances) {
      const restaurant = b.restaurant;

      const ownedGroups = (restaurant.ownedGroups ?? []) as { id: string; name: string; description: string; ownerId: string }[];
      const membershipGroups = (restaurant.groupMemberships ?? [])
        .map((gm) => gm.group)
        .filter(
          (g): g is { id: string; name: string; description: string; ownerId: string } => !!g,
        );

      const allGroups = [...ownedGroups, ...membershipGroups];

      if (allGroups.length > 0) {
        for (const group of allGroups) {
          if (!grouped[group.id]) {
            grouped[group.id] = {
              targetId: group.id,
              name: group.name,
              stars_drink: 0,
              stars_meal: 0,
              balance: 0,
              isGroup: true,
              _restaurantIdForVouchers: group.ownerId,
            };
          }

          grouped[group.id]!.stars_drink += b.stars_drink;
          grouped[group.id]!.stars_meal += b.stars_meal;
          grouped[group.id]!.balance += b.balance;
        }
      } else {
        if (!grouped[restaurant.id]) {
          grouped[restaurant.id] = {
            targetId: restaurant.id,
            name: restaurant.name,
            stars_drink: 0,
            stars_meal: 0,
            balance: 0,
            isGroup: false,
            _restaurantIdForVouchers: restaurant.id,
          };
        }

        grouped[restaurant.id]!.stars_drink += b.stars_drink;
        grouped[restaurant.id]!.stars_meal += b.stars_meal;
        grouped[restaurant.id]!.balance += b.balance;
      }
    }

    const restaurantIdsForVouchers = [
      ...new Set(Object.values(grouped).map((x) => x._restaurantIdForVouchers)),
    ];
    const restaurantsVoucherSettings = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIdsForVouchers } },
      select: { id: true, mealPointsPerVoucher: true, drinkPointsPerVoucher: true },
    });
    const voucherMap = new Map(
      restaurantsVoucherSettings.map((r) => [
        r.id,
        {
          mealPointsPerVoucher: r.mealPointsPerVoucher,
          drinkPointsPerVoucher: r.drinkPointsPerVoucher,
        },
      ]),
    );

    const payload = Object.values(grouped).map((row) => {
      const settings = voucherMap.get(row._restaurantIdForVouchers);
      const mealPointsPerVoucher = settings?.mealPointsPerVoucher ?? null;
      const drinkPointsPerVoucher = settings?.drinkPointsPerVoucher ?? null;
      const vouchers_meal =
        mealPointsPerVoucher != null && mealPointsPerVoucher > 0
          ? Math.floor(row.stars_meal / mealPointsPerVoucher)
          : null;
      const vouchers_drink =
        drinkPointsPerVoucher != null && drinkPointsPerVoucher > 0
          ? Math.floor(row.stars_drink / drinkPointsPerVoucher)
          : null;
      const { _restaurantIdForVouchers: _, ...rest } = row;
      return {
        ...rest,
        mealPointsPerVoucher,
        drinkPointsPerVoucher,
        vouchers_meal,
        vouchers_drink,
      };
    });

    return successResponse(
      res,
      'Restaurants with balance fetched successfully',
      payload,
    );
  } catch (error) {
    console.error('Get user restaurants with balance error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
/**
 * @swagger
 * /client/balance/packages/{restaurantId}:
 *   get:
 *     summary: Get public packages for a specific restaurant
 *     tags: [balance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the restaurant
 *     responses:
 *       200:
 *         description: Packages fetched successfully
 *       404:
 *         description: Restaurant not found
 */
export const listPublicPackages = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }

    // check for found the restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    // return active and publice packages
    const packages = await prisma.topUpPackage.findMany({
      where: {
        restaurantId,
        isActive: true,
        isPublic: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, 'Packages fetched', packages);
  } catch (error) {
    console.error('listPublicPackages error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
/**
 * @swagger
 * /client/balance/scan-qr:
 *   post:
 *     summary: Scan QR code to earn stars at a restaurant
 *     tags: [balance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrCode
 *               - latitude
 *               - longitude
 *             properties:
 *               qrCode:
 *                 type: string
 *                 example: "SAMPLE_QR_CODE_123"
 *               latitude:
 *                 type: number
 *                 example: 35.6895
 *               longitude:
 *                 type: number
 *                 example: 139.6917
 *     responses:
 *       200:
 *         description: Stars updated successfully
 *       400:
 *         description: Invalid input or QR code
 *       403:
 *         description: User not at restaurant location
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const scanQrCode = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { qrCode, latitude, longitude } = req.body;

    if (!qrCode) {
      return errorResponse(res, 'QR code is required', 400);
    }
    if (latitude == null || longitude == null) {
      return errorResponse(res, 'User location (latitude, longitude) is required', 400);
    }

    // search of the restaurant use qr
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ qrCode_meal: qrCode }, { qrCode_drink: qrCode }],
      },
    });

    if (!restaurant) {
      return errorResponse(res, 'Invalid QR code', 400);
    }

    const isMeal = restaurant.qrCode_meal === qrCode;
    const isDrink = restaurant.qrCode_drink === qrCode;

    if (!isMeal && !isDrink) {
      return errorResponse(res, 'Invalid QR code type', 400);
    }

    // check the locations of scan
    const distance = calculateDistance(
      latitude,
      longitude,
      restaurant.latitude,
      restaurant.longitude,
    );

    const allowedRadius = 100;
    if (distance > allowedRadius) {
      return errorResponse(res, 'You must be at the restaurant location to scan this QR', 403);
    }

    // update or create balance
    let balance = await prisma.userRestaurantBalance.findUnique({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId: restaurant.id,
        },
      },
    });

    if (!balance) {
      balance = await prisma.userRestaurantBalance.create({
        data: {
          userId,
          restaurantId: restaurant.id,
          stars_meal: isMeal ? 1 : 0,
          stars_drink: isDrink ? 1 : 0,
          balance: 0,
        },
      });
    } else {
      balance = await prisma.userRestaurantBalance.update({
        where: { id: balance.id },
        data: {
          stars_meal: isMeal ? balance.stars_meal + 1 : balance.stars_meal,
          stars_drink: isDrink ? balance.stars_drink + 1 : balance.stars_drink,
        },
      });
    }

    // save in ScanLog
    await prisma.scanLog.create({
      data: {
        userId,
        restaurantId: restaurant.id,
        type: isMeal ? 'meal' : 'drink',
        qrCode,
        latitude,
        longitude,
      },
    });

    // save in StarsTransaction
    await prisma.starsTransaction.create({
      data: {
        userId,
        restaurantId: restaurant.id,
        type: isMeal ? 'meal' : 'drink',
        stars_meal: isMeal ? 1 : 0,
        stars_drink: isDrink ? 1 : 0,
      },
    });

    await sendNotificationToUser({
      userId: userId,
      title: 'You received a stars!',
      body: `You received ${isMeal ? 1 : 0}  stars meal & ${isDrink ? 1 : 0} stars drink from ${restaurant.name}`,
      type: 'STARS',
    });

    return successResponse(res, 'Stars updated successfully', balance);
  } catch (error) {
    console.error('Scan QR error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/balance/pay:
 *   post:
 *     summary: Pay with meal or drink stars at a restaurant or group
 *     description: currencyType must be stars_meal or stars_drink. For EUR money use POST /client/wallet/pay-restaurant.
 *     tags: [balance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetId
 *               - currencyType
 *               - amount
 *             properties:
 *               targetId:
 *                 type: string
 *                 description: UUID of the restaurant or restaurant group
 *                 example: "RESTAURANT_OR_GROUP_UUID_123"
 *               currencyType:
 *                 type: string
 *                 enum: [stars_meal, stars_drink]
 *                 example: stars_meal
 *               amount:
 *                 type: number
 *                 example: 20
 *     responses:
 *       200:
 *         description: Payment successful
 *       400:
 *         description: Invalid input or insufficient balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant or group not found
 *       500:
 *         description: Server error
 */

export const payAtRestaurant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetId, currencyType, amount } = req.body;

    if (!targetId || !currencyType || !amount) {
      return errorResponse(res, 'targetId, currencyType and amount are required', 400);
    }

    if (!['stars_meal', 'stars_drink'].includes(currencyType)) {
      return errorResponse(res, 'Invalid currencyType', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, userId: true },
    });
    // pay for restaurant
    if (restaurant) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, userId: true },
      });
      if (!restaurant) {
        return errorResponse(res, 'Target must be a restaurant', 400);
      }

      // get user balance for this restaurant
      let balance = await prisma.userRestaurantBalance.findUnique({
        where: { userId_restaurantId: { userId, restaurantId: restaurant.id } },
      });
      if (!balance) return errorResponse(res, 'No balance found for this restaurant', 400);

      if (currencyType === 'stars_meal' && balance.stars_meal < amount)
        return errorResponse(res, 'Insufficient meal stars', 400);
      if (currencyType === 'stars_drink' && balance.stars_drink < amount)
        return errorResponse(res, 'Insufficient drink stars', 400);

      await prisma.userRestaurantBalance.update({
        where: { id: balance.id },
        data: {
          balance: balance.balance,
          stars_meal:
            currencyType === 'stars_meal' ? balance.stars_meal - amount : balance.stars_meal,
          stars_drink:
            currencyType === 'stars_drink' ? balance.stars_drink - amount : balance.stars_drink,
        },
      });

      // log the transaction
      await prisma.purchase.create({
        data: { userId, restaurantId: restaurant.id, paymentType: currencyType, amount },
      });

      // send notifications
      await sendNotificationToUser({
        userId,
        title: 'Payment Successful',
        body: `You spent ${amount} ${currencyType} at ${restaurant.name}`,
        type: 'PAYMENT',
      });
      await sendNotificationToUser({
        userId: restaurant.userId,
        title: 'New Payment Received',
        body: `A user paid ${amount} ${currencyType} at your restaurant`,
        type: 'PAYMENT',
      });

      return successResponse(res, 'Payment successful');
    }

    // pay for the group
    const group = await prisma.restaurantGroup.findUnique({
      where: { id: targetId },
      include: {
        members: { include: { restaurant: true } },
      },
    });
    if (!group) return errorResponse(res, 'Group not found', 404);

    // get all user balances from group's restaurant
    const balances = await prisma.userRestaurantBalance.findMany({
      where: {
        userId,
        restaurantId: {
          in: group.members.map((m) => m.restaurantId),
        },
      },
    });

    if (!balances || balances.length === 0)
      return errorResponse(res, 'No balances found for this group', 400);

    const total = balances.reduce((sum, b) => {
      if (currencyType === 'stars_meal') return sum + b.stars_meal;
      return sum + b.stars_drink;
    }, 0);

    if (total < amount) return errorResponse(res, 'Insufficient group balance', 400);

    // discount from all the group;s restaurant user balances
    let remaining = amount;
    for (const b of balances) {
      if (remaining <= 0) break;
      let deduct = 0;

      if (currencyType === 'stars_meal') {
        deduct = Math.min(b.stars_meal, remaining);
        await prisma.userRestaurantBalance.update({
          where: { id: b.id },
          data: { stars_meal: b.stars_meal - deduct },
        });
      } else if (currencyType === 'stars_drink') {
        deduct = Math.min(b.stars_drink, remaining);
        await prisma.userRestaurantBalance.update({
          where: { id: b.id },
          data: { stars_drink: b.stars_drink - deduct },
        });
      }

      remaining -= deduct;
    }

    // log
    await prisma.purchase.create({
      data: { userId, groupId: group.id, paymentType: currencyType, amount },
    });

    const ownerRestaurant = await prisma.restaurant.findUnique({
      where: { id: group.ownerId },
      select: { userId: true },
    });
    // notifications
    await sendNotificationToUser({
      userId,
      title: 'Payment Successful',
      body: `You spent ${amount} ${currencyType} across group ${group.name}`,
      type: 'PAYMENT',
    });
    if (ownerRestaurant) {
      await sendNotificationToUser({
        userId: ownerRestaurant.userId,
        title: 'New Group Payment',
        body: `A user paid ${amount} ${currencyType} across your group ${group.name}`,
        type: 'PAYMENT',
      });
    }

    return successResponse(res, 'Group payment successful');
  } catch (error) {
    console.error('Payment error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

