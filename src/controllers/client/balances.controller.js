"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftBalance = exports.payAtRestaurant = exports.scanQrCode = exports.listPublicPackages = exports.getUserRestaurantsWithBalance = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const check_location_1 = require("../../utils/check_location");
const notification_service_1 = require("../../services/notification.service");
const prisma = new client_1.PrismaClient();
/**
 * @swagger
 * tags:
 *   name: balance
 *   description: APIs for managing user balances and QR scans
 */
/**
 * @swagger
 * /api/client/balance/with-restaurants:
 *   get:
 *     summary: Get all restaurants where the user has a balance or stars
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
const getUserRestaurantsWithBalance = async (req, res) => {
    try {
        const userId = req.user.id;
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
        const grouped = {};
        for (const b of balances) {
            const restaurant = b.restaurant;
            const ownedGroups = restaurant.ownedGroups ?? [];
            const membershipGroups = (restaurant.groupMemberships ?? [])
                .map((gm) => gm.group)
                .filter((g) => !!g);
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
                        };
                    }
                    grouped[group.id].stars_drink += b.stars_drink;
                    grouped[group.id].stars_meal += b.stars_meal;
                    grouped[group.id].balance += b.balance;
                }
            }
            else {
                if (!grouped[restaurant.id]) {
                    grouped[restaurant.id] = {
                        targetId: restaurant.id,
                        name: restaurant.name,
                        stars_drink: 0,
                        stars_meal: 0,
                        balance: 0,
                        isGroup: false,
                    };
                }
                grouped[restaurant.id].stars_drink += b.stars_drink;
                grouped[restaurant.id].stars_meal += b.stars_meal;
                grouped[restaurant.id].balance += b.balance;
            }
        }
        return (0, response_1.successResponse)(res, 'Restaurants with balance fetched successfully', Object.values(grouped));
    }
    catch (error) {
        console.error('Get user restaurants with balance error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.getUserRestaurantsWithBalance = getUserRestaurantsWithBalance;
/**
 * @swagger
 * /client/balance/packages/{restaurantId}:
 *   get:
 *     summary: Get public packages for a specific restaurant
 *     tags: [balance]
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
const listPublicPackages = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        if (!restaurantId) {
            return (0, response_1.errorResponse)(res, 'Restaurant ID is required', 400);
        }
        // check for found the restaurant
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        if (!restaurant) {
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
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
        return (0, response_1.successResponse)(res, 'Packages fetched', packages);
    }
    catch (error) {
        console.error('listPublicPackages error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.listPublicPackages = listPublicPackages;
/**
 * @swagger
 * /api/client/balance/scan-qr:
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
const scanQrCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const { qrCode, latitude, longitude } = req.body;
        if (!qrCode) {
            return (0, response_1.errorResponse)(res, 'QR code is required', 400);
        }
        if (latitude == null || longitude == null) {
            return (0, response_1.errorResponse)(res, 'User location (latitude, longitude) is required', 400);
        }
        // search of the restaurant use qr
        const restaurant = await prisma.restaurant.findFirst({
            where: {
                OR: [{ qrCode_meal: qrCode }, { qrCode_drink: qrCode }],
            },
        });
        if (!restaurant) {
            return (0, response_1.errorResponse)(res, 'Invalid QR code', 400);
        }
        const isMeal = restaurant.qrCode_meal === qrCode;
        const isDrink = restaurant.qrCode_drink === qrCode;
        if (!isMeal && !isDrink) {
            return (0, response_1.errorResponse)(res, 'Invalid QR code type', 400);
        }
        // check the locations of scan
        const distance = (0, check_location_1.calculateDistance)(latitude, longitude, restaurant.latitude, restaurant.longitude);
        const allowedRadius = 100;
        if (distance > allowedRadius) {
            return (0, response_1.errorResponse)(res, 'You must be at the restaurant location to scan this QR', 403);
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
                    stars_meal: isMeal ? 10 : 0,
                    stars_drink: isDrink ? 10 : 0,
                    balance: 0,
                },
            });
        }
        else {
            balance = await prisma.userRestaurantBalance.update({
                where: { id: balance.id },
                data: {
                    stars_meal: isMeal ? balance.stars_meal + 10 : balance.stars_meal,
                    stars_drink: isDrink ? balance.stars_drink + 10 : balance.stars_drink,
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
                stars_meal: isMeal ? 10 : 0,
                stars_drink: isDrink ? 10 : 0,
            },
        });
        await (0, notification_service_1.sendNotificationToUser)({
            userId: userId,
            title: 'You received a stars!',
            body: `You received ${isMeal ? 10 : 0}  stars meal & ${isDrink ? 10 : 0} stars drink from ${restaurant.name}`,
            type: 'STARS',
        });
        return (0, response_1.successResponse)(res, 'Stars updated successfully', balance);
    }
    catch (error) {
        console.error('Scan QR error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.scanQrCode = scanQrCode;
/**
 * @swagger
 * /api/client/balance/pay:
 *   post:
 *     summary: Pay at a single restaurant or across a restaurant group using balance or stars
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
 *                 enum: [balance, stars_meal, stars_drink]
 *                 example: "balance"
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
const payAtRestaurant = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetId, currencyType, amount } = req.body;
        if (!targetId || !currencyType || !amount) {
            return (0, response_1.errorResponse)(res, 'targetId, currencyType and amount are required', 400);
        }
        if (!['balance', 'stars_meal', 'stars_drink'].includes(currencyType)) {
            return (0, response_1.errorResponse)(res, 'Invalid currencyType', 400);
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
                return (0, response_1.errorResponse)(res, 'Target must be a restaurant', 400);
            }
            // get user balance for this restaurant
            let balance = await prisma.userRestaurantBalance.findUnique({
                where: { userId_restaurantId: { userId, restaurantId: restaurant.id } },
            });
            if (!balance)
                return (0, response_1.errorResponse)(res, 'No balance found for this restaurant', 400);
            if (currencyType === 'balance' && balance.balance < amount)
                return (0, response_1.errorResponse)(res, 'Insufficient balance', 400);
            if (currencyType === 'stars_meal' && balance.stars_meal < amount)
                return (0, response_1.errorResponse)(res, 'Insufficient meal stars', 400);
            if (currencyType === 'stars_drink' && balance.stars_drink < amount)
                return (0, response_1.errorResponse)(res, 'Insufficient drink stars', 400);
            // discount the balance paied
            await prisma.userRestaurantBalance.update({
                where: { id: balance.id },
                data: {
                    balance: currencyType === 'balance' ? balance.balance - amount : balance.balance,
                    stars_meal: currencyType === 'stars_meal' ? balance.stars_meal - amount : balance.stars_meal,
                    stars_drink: currencyType === 'stars_drink' ? balance.stars_drink - amount : balance.stars_drink,
                },
            });
            // log the transaction
            await prisma.purchase.create({
                data: { userId, restaurantId: restaurant.id, paymentType: currencyType, amount },
            });
            // send notifications
            await (0, notification_service_1.sendNotificationToUser)({
                userId,
                title: 'Payment Successful',
                body: `You spent ${amount} ${currencyType} at ${restaurant.name}`,
                type: 'PAYMENT',
            });
            await (0, notification_service_1.sendNotificationToUser)({
                userId: restaurant.userId,
                title: 'New Payment Received',
                body: `A user paid ${amount} ${currencyType} at your restaurant`,
                type: 'PAYMENT',
            });
            return (0, response_1.successResponse)(res, 'Payment successful');
        }
        // pay for the group
        const group = await prisma.restaurantGroup.findUnique({
            where: { id: targetId },
            include: {
                members: { include: { restaurant: true } },
            },
        });
        if (!group)
            return (0, response_1.errorResponse)(res, 'Group not found', 404);
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
            return (0, response_1.errorResponse)(res, 'No balances found for this group', 400);
        // addition all balances
        const total = balances.reduce((sum, b) => {
            if (currencyType === 'balance')
                return sum + b.balance;
            if (currencyType === 'stars_meal')
                return sum + b.stars_meal;
            if (currencyType === 'stars_drink')
                return sum + b.stars_drink;
            return sum;
        }, 0);
        if (total < amount)
            return (0, response_1.errorResponse)(res, 'Insufficient group balance', 400);
        // discount from all the group;s restaurant user balances
        let remaining = amount;
        for (const b of balances) {
            if (remaining <= 0)
                break;
            let deduct = 0;
            if (currencyType === 'balance') {
                deduct = Math.min(b.balance, remaining);
                await prisma.userRestaurantBalance.update({
                    where: { id: b.id },
                    data: { balance: b.balance - deduct },
                });
            }
            else if (currencyType === 'stars_meal') {
                deduct = Math.min(b.stars_meal, remaining);
                await prisma.userRestaurantBalance.update({
                    where: { id: b.id },
                    data: { stars_meal: b.stars_meal - deduct },
                });
            }
            else if (currencyType === 'stars_drink') {
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
        await (0, notification_service_1.sendNotificationToUser)({
            userId,
            title: 'Payment Successful',
            body: `You spent ${amount} ${currencyType} across group ${group.name}`,
            type: 'PAYMENT',
        });
        if (ownerRestaurant) {
            await (0, notification_service_1.sendNotificationToUser)({
                userId: ownerRestaurant.userId,
                title: 'New Group Payment',
                body: `A user paid ${amount} ${currencyType} across your group ${group.name}`,
                type: 'PAYMENT',
            });
        }
        return (0, response_1.successResponse)(res, 'Group payment successful');
    }
    catch (error) {
        console.error('Payment error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.payAtRestaurant = payAtRestaurant;
/**
 * @swagger
 * /api/client/balance/gift:
 *   post:
 *     summary: Gift balance or stars to another user via QR code
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
 *                 enum: [balance, stars_meal, stars_drink]
 *                 description: Type of balance to gift
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
const giftBalance = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { qrCode, targetId, currencyType, amount } = req.body;
        if (!qrCode || !targetId || !currencyType || !amount) {
            return (0, response_1.errorResponse)(res, 'All fields are required', 400);
        }
        if (!['balance', 'stars_meal', 'stars_drink'].includes(currencyType)) {
            return (0, response_1.errorResponse)(res, 'Invalid currencyType', 400);
        }
        if (amount <= 0) {
            return (0, response_1.errorResponse)(res, 'Amount must be greater than 0', 400);
        }
        // get the recipient qr
        const recipient = await prisma.user.findUnique({ where: { qrCode } });
        if (!recipient)
            return (0, response_1.errorResponse)(res, 'Recipient not found', 404);
        if (recipient.id === senderId)
            return (0, response_1.errorResponse)(res, 'Cannot gift to yourself', 400);
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
            if (!senderBalance)
                return (0, response_1.errorResponse)(res, 'No balance found for this restaurant', 400);
            const available = currencyType === 'balance'
                ? senderBalance.balance
                : currencyType === 'stars_meal'
                    ? senderBalance.stars_meal
                    : senderBalance.stars_drink;
            if (available < amount)
                return (0, response_1.errorResponse)(res, 'Insufficient balance', 400);
            await prisma.$transaction([
                // discount
                prisma.userRestaurantBalance.update({
                    where: { id: senderBalance.id },
                    data: currencyType === 'balance'
                        ? { balance: { decrement: amount } }
                        : currencyType === 'stars_meal'
                            ? { stars_meal: { decrement: amount } }
                            : { stars_drink: { decrement: amount } },
                }),
                // add the balance to the recipient
                prisma.userRestaurantBalance.upsert({
                    where: {
                        userId_restaurantId: {
                            userId: recipient.id,
                            restaurantId: restaurant.id,
                        },
                    },
                    update: currencyType === 'balance'
                        ? { balance: { increment: amount } }
                        : currencyType === 'stars_meal'
                            ? { stars_meal: { increment: amount } }
                            : { stars_drink: { increment: amount } },
                    create: {
                        userId: recipient.id,
                        restaurantId: restaurant.id,
                        balance: currencyType === 'balance' ? amount : 0,
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
            await (0, notification_service_1.sendNotificationToUser)({
                userId: senderId,
                title: 'Gift Sent',
                body: `You gifted ${amount} ${currencyType} to ${recipient.fullName}`,
                type: 'GIFT',
            });
            await (0, notification_service_1.sendNotificationToUser)({
                userId: recipient.id,
                title: 'Gift Received',
                body: `You received ${amount} ${currencyType} from ${req.user.fullName}`,
                type: 'GIFT',
            });
            return (0, response_1.successResponse)(res, 'Gift sent successfully');
        }
        // gift from group balance
        const group = await prisma.restaurantGroup.findUnique({
            where: { id: targetId },
            include: { members: { select: { restaurantId: true } } },
        });
        if (!group)
            return (0, response_1.errorResponse)(res, 'Target not found', 404);
        const balances = await prisma.userRestaurantBalance.findMany({
            where: {
                userId: senderId,
                restaurantId: { in: group.members.map((m) => m.restaurantId) },
            },
        });
        if (balances.length === 0)
            return (0, response_1.errorResponse)(res, 'No balances found for this group', 400);
        // add the balances
        const total = balances.reduce((sum, b) => {
            if (currencyType === 'balance')
                return sum + b.balance;
            if (currencyType === 'stars_meal')
                return sum + b.stars_meal;
            if (currencyType === 'stars_drink')
                return sum + b.stars_drink;
            return sum;
        }, 0);
        if (total < amount)
            return (0, response_1.errorResponse)(res, 'Insufficient group balance', 400);
        let remaining = amount;
        const txs = [];
        for (const b of balances) {
            if (remaining <= 0)
                break;
            let deduct = 0;
            if (currencyType === 'balance') {
                deduct = Math.min(b.balance, remaining);
                txs.push(prisma.userRestaurantBalance.update({
                    where: { id: b.id },
                    data: { balance: b.balance - deduct },
                }), prisma.userRestaurantBalance.upsert({
                    where: {
                        userId_restaurantId: {
                            userId: recipient.id,
                            restaurantId: b.restaurantId,
                        },
                    },
                    update: { balance: { increment: deduct } },
                    create: {
                        userId: recipient.id,
                        restaurantId: b.restaurantId,
                        balance: deduct,
                        stars_meal: 0,
                        stars_drink: 0,
                    },
                }));
            }
            else if (currencyType === 'stars_meal') {
                deduct = Math.min(b.stars_meal, remaining);
                txs.push(prisma.userRestaurantBalance.update({
                    where: { id: b.id },
                    data: { stars_meal: b.stars_meal - deduct },
                }), prisma.userRestaurantBalance.upsert({
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
                }));
            }
            else if (currencyType === 'stars_drink') {
                deduct = Math.min(b.stars_drink, remaining);
                txs.push(prisma.userRestaurantBalance.update({
                    where: { id: b.id },
                    data: { stars_drink: b.stars_drink - deduct },
                }), prisma.userRestaurantBalance.upsert({
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
                }));
            }
            remaining -= deduct;
        }
        txs.push(prisma.gift.create({
            data: {
                fromUserId: senderId,
                toUserId: recipient.id,
                groupId: group.id,
                type: currencyType,
                amount,
                status: 'completed',
            },
        }));
        await prisma.$transaction(txs);
        await (0, notification_service_1.sendNotificationToUser)({
            userId: senderId,
            title: 'Gift Sent',
            body: `You gifted ${amount} ${currencyType} to ${recipient.fullName} from group ${group.name}`,
            type: 'GIFT',
        });
        await (0, notification_service_1.sendNotificationToUser)({
            userId: recipient.id,
            title: 'Gift Received',
            body: `You received ${amount} ${currencyType} from ${req.user.fullName} (group ${group.name})`,
            type: 'GIFT',
        });
        return (0, response_1.successResponse)(res, 'Group gift sent successfully');
    }
    catch (error) {
        console.error('Gift balance error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.giftBalance = giftBalance;
//# sourceMappingURL=balances.controller.js.map