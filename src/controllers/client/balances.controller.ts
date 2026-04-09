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

/**
 * @swagger
 * /client/balance/validate-gift-recipient:
 *   get:
 *     summary: Validate if a QR code is a valid gift recipient (user QR, not restaurant)
 *     tags: [balance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: success true; data.valid boolean; data.reason when valid is false
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                       enum: [restaurant_code, not_found, self]
 *       401:
 *         description: Unauthorized
 */
export const validateGiftRecipient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const qrCode = req.query.qrCode as string;
    if (!qrCode || !qrCode.trim()) {
      return successResponse(res, 'Validation result', { valid: false, reason: 'not_found' });
    }

    const recipient = await prisma.user.findUnique({ where: { qrCode: qrCode.trim() } });
    if (recipient) {
      if (recipient.id === userId) {
        return successResponse(res, 'Validation result', { valid: false, reason: 'self' });
      }
      return successResponse(res, 'Validation result', { valid: true });
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ qrCode_meal: qrCode.trim() }, { qrCode_drink: qrCode.trim() }],
      },
    });
    if (restaurant) {
      return successResponse(res, 'Validation result', { valid: false, reason: 'restaurant_code' });
    }

    return successResponse(res, 'Validation result', { valid: false, reason: 'not_found' });
  } catch (error) {
    console.error('validateGiftRecipient error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/balance/gift:
 *   post:
 *     summary: Gift meal or drink stars to another user via QR code
 *     description: currencyType must be stars_meal or stars_drink. Monetary gifts are not supported here; use Wallet flows if needed.
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
 *               - targetId
 *               - currencyType
 *               - amount
 *             properties:
 *               qrCode:
 *                 type: string
 *                 description: QR code of the recipient
 *               targetId:
 *                 type: string
 *                 description: UUID of the restaurant or restaurant group to gift from
 *               currencyType:
 *                 type: string
 *                 enum: [stars_meal, stars_drink]
 *                 description: Star type to gift
 *               amount:
 *                 type: number
 *                 description: Amount to gift
 *     responses:
 *       200:
 *         description: Gift successful
 *       400:
 *         description: Invalid input or insufficient balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recipient not found
 *       500:
 *         description: Server error
 */

export const giftBalance = async (req: Request, res: Response) => {
  try {
    const senderId = req.user!.id;
    const { qrCode, targetId, currencyType, amount } = req.body as {
      qrCode: string;
      targetId: string;
      currencyType: 'stars_meal' | 'stars_drink';
      amount: number;
    };

    if (!qrCode || !targetId || !currencyType || !amount) {
      return errorResponse(res, 'All fields are required', 400);
    }
    if (!['stars_meal', 'stars_drink'].includes(currencyType)) {
      return errorResponse(res, 'Invalid currencyType', 400);
    }
    if (amount <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    // get the recipient qr
    const recipient = await prisma.user.findUnique({ where: { qrCode } });
    if (!recipient) return errorResponse(res, 'Recipient not found', 404);
    if (recipient.id === senderId) return errorResponse(res, 'Cannot gift to yourself', 400);

    // check the target is restaurant or group
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: targetId },
      select: { id: true, name: true },
    });

    if (restaurant) {
      // gift fron restaurant user balance
      const senderBalance = await prisma.userRestaurantBalance.findUnique({
        where: {
          userId_restaurantId: { userId: senderId, restaurantId: restaurant.id },
        },
      });
      if (!senderBalance) return errorResponse(res, 'No balance found for this restaurant', 400);

      const available =
        currencyType === 'stars_meal' ? senderBalance.stars_meal : senderBalance.stars_drink;

      if (available < amount) return errorResponse(res, 'Insufficient balance', 400);

      await prisma.$transaction([
        prisma.userRestaurantBalance.update({
          where: { id: senderBalance.id },
          data:
            currencyType === 'stars_meal'
              ? { stars_meal: { decrement: amount } }
              : { stars_drink: { decrement: amount } },
        }),

        prisma.userRestaurantBalance.upsert({
          where: {
            userId_restaurantId: {
              userId: recipient.id,
              restaurantId: restaurant.id,
            },
          },
          update:
            currencyType === 'stars_meal'
              ? { stars_meal: { increment: amount } }
              : { stars_drink: { increment: amount } },
          create: {
            userId: recipient.id,
            restaurantId: restaurant.id,
            balance: 0,
            stars_meal: currencyType === 'stars_meal' ? amount : 0,
            stars_drink: currencyType === 'stars_drink' ? amount : 0,
          },
        }),

        prisma.gift.create({
          data: {
            fromUserId: senderId,
            toUserId: recipient.id,
            restaurantId: restaurant.id,
            type: currencyType,
            amount,
            status: 'completed',
          },
        }),
      ]);

      await sendNotificationToUser({
        userId: senderId,
        title: 'Gift Sent',
        body: `You gifted ${amount} ${currencyType} to ${recipient.fullName}`,
        type: 'GIFT',
      });
      await sendNotificationToUser({
        userId: recipient.id,
        title: 'Gift Received',
        body: `You received ${amount} ${currencyType} from ${req.user!.fullName}`,
        type: 'GIFT',
      });

      return successResponse(res, 'Gift sent successfully');
    }

    // gift from group balance
    const group = await prisma.restaurantGroup.findUnique({
      where: { id: targetId },
      include: { members: { select: { restaurantId: true } } },
    });
    if (!group) return errorResponse(res, 'Target not found', 404);

    const balances = await prisma.userRestaurantBalance.findMany({
      where: {
        userId: senderId,
        restaurantId: { in: group.members.map((m) => m.restaurantId) },
      },
    });
    if (balances.length === 0) return errorResponse(res, 'No balances found for this group', 400);

    const total = balances.reduce((sum, b) => {
      if (currencyType === 'stars_meal') return sum + b.stars_meal;
      return sum + b.stars_drink;
    }, 0);

    if (total < amount) return errorResponse(res, 'Insufficient group balance', 400);

    let remaining = amount;
    const txs: any[] = [];

    for (const b of balances) {
      if (remaining <= 0) break;
      let deduct = 0;

      if (currencyType === 'stars_meal') {
        deduct = Math.min(b.stars_meal, remaining);
        txs.push(
          prisma.userRestaurantBalance.update({
            where: { id: b.id },
            data: { stars_meal: b.stars_meal - deduct },
          }),
          prisma.userRestaurantBalance.upsert({
            where: {
              userId_restaurantId: {
                userId: recipient.id,
                restaurantId: b.restaurantId,
              },
            },
            update: { stars_meal: { increment: deduct } },
            create: {
              userId: recipient.id,
              restaurantId: b.restaurantId,
              balance: 0,
              stars_meal: deduct,
              stars_drink: 0,
            },
          }),
        );
      } else if (currencyType === 'stars_drink') {
        deduct = Math.min(b.stars_drink, remaining);
        txs.push(
          prisma.userRestaurantBalance.update({
            where: { id: b.id },
            data: { stars_drink: b.stars_drink - deduct },
          }),
          prisma.userRestaurantBalance.upsert({
            where: {
              userId_restaurantId: {
                userId: recipient.id,
                restaurantId: b.restaurantId,
              },
            },
            update: { stars_drink: { increment: deduct } },
            create: {
              userId: recipient.id,
              restaurantId: b.restaurantId,
              balance: 0,
              stars_meal: 0,
              stars_drink: deduct,
            },
          }),
        );
      }

      remaining -= deduct;
    }

    txs.push(
      prisma.gift.create({
        data: {
          fromUserId: senderId,
          toUserId: recipient.id,
          groupId: group.id,
          type: currencyType,
          amount,
          status: 'completed',
        },
      }),
    );

    await prisma.$transaction(txs);

    await sendNotificationToUser({
      userId: senderId,
      title: 'Gift Sent',
      body: `You gifted ${amount} ${currencyType} to ${recipient.fullName} from group ${group.name}`,
      type: 'GIFT',
    });
    await sendNotificationToUser({
      userId: recipient.id,
      title: 'Gift Received',
      body: `You received ${amount} ${currencyType} from ${req.user!.fullName} (group ${group.name})`,
      type: 'GIFT',
    });

    return successResponse(res, 'Group gift sent successfully');
  } catch (error) {
    console.error('Gift balance error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
