"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRestaurantByOwner = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
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
const updateRestaurantByOwner = async (req, res) => {
    try {
        const { name, address, latitude, longitude, logo } = req.body;
        const restaurant = await prisma.restaurant.findUnique({
            where: { userId: req.user.id },
        });
        if (!restaurant) {
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
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
        return (0, response_1.successResponse)(res, 'Restaurant updated successfully', updated);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.updateRestaurantByOwner = updateRestaurantByOwner;
//# sourceMappingURL=restaurant.info.controller.js.map