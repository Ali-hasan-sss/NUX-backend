"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdsForRestaurant = exports.deleteAd = exports.updateAd = exports.createAd = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
/**
 * @swagger
 * tags:
 *   name: Ads
 *   description: Ads management for restaurants
 */
/**
 * @swagger
 * /restaurants/ads:
 *   post:
 *     summary: Create a new ad (restaurant only, Pro plan required)
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - image
 *             properties:
 *               title:
 *                 type: string
 *                 description: Ad title
 *               description:
 *                 type: string
 *                 description: Ad description
 *               image:
 *                 type: string
 *                 description: Ad image URL
 *               category:
 *                 type: string
 *                 description: Ad category
 *     responses:
 *       200:
 *         description: Ad created successfully
 *       403:
 *         description: Restaurant plan is not Pro
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
const createAd = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, image, category } = req.body;
        const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        const ad = await prisma.ad.create({
            data: { restaurantId: restaurant.id, title, description, image, category },
        });
        return (0, response_1.successResponse)(res, 'Ad created successfully', ad);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.createAd = createAd;
/**
 * @swagger
 * /restaurants/ads/{id}:
 *   put:
 *     summary: Update an existing ad (restaurant only, must be owner)
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ad updated successfully
 *       400:
 *         description: Invalid ad ID
 *       403:
 *         description: Not allowed to edit this ad
 *       404:
 *         description: Ad or restaurant not found
 *       500:
 *         description: Internal server error
 */
const updateAd = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, description, image, category } = req.body;
        const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        if (!id)
            return (0, response_1.errorResponse)(res, 'Ad ID is required', 400);
        const ad = await prisma.ad.findUnique({ where: { id: parseInt(id) } });
        if (!ad)
            return (0, response_1.errorResponse)(res, 'Ad not found', 404);
        if (ad.restaurantId !== restaurant.id)
            return (0, response_1.errorResponse)(res, 'You cannot edit this ad', 403);
        const updatedAd = await prisma.ad.update({
            where: { id: ad.id },
            data: { title, description, image, category },
        });
        return (0, response_1.successResponse)(res, 'Ad updated successfully', updatedAd);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.updateAd = updateAd;
/**
 * @swagger
 * /restaurants/ads/{id}:
 *   delete:
 *     summary: Delete an ad (restaurant only, must be owner)
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Ad ID
 *     responses:
 *       200:
 *         description: Ad deleted successfully
 *       400:
 *         description: Invalid ad ID
 *       403:
 *         description: Not allowed to delete this ad
 *       404:
 *         description: Ad or restaurant not found
 *       500:
 *         description: Internal server error
 */
const deleteAd = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        if (!id)
            return (0, response_1.errorResponse)(res, 'Ad ID is required', 400);
        const ad = await prisma.ad.findUnique({ where: { id: parseInt(id) } });
        if (!ad)
            return (0, response_1.errorResponse)(res, 'Ad not found', 404);
        if (ad.restaurantId !== restaurant.id)
            return (0, response_1.errorResponse)(res, 'You cannot delete this ad', 403);
        await prisma.ad.delete({ where: { id: ad.id } });
        return (0, response_1.successResponse)(res, 'Ad deleted successfully');
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.deleteAd = deleteAd;
/**
 * @swagger
 * /restaurants/ads/my:
 *   get:
 *     summary: Get all ads of the authenticated restaurant
 *     tags: [Ads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ads of this restaurant
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   image:
 *                     type: string
 *                   category:
 *                     type: string
 */
const getAdsForRestaurant = async (req, res) => {
    try {
        const userId = req.user.id;
        const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        const ads = await prisma.ad.findMany({
            where: { restaurantId: restaurant.id },
            orderBy: { createdAt: 'desc' },
        });
        return (0, response_1.successResponse)(res, 'Restaurant ads fetched successfully', ads);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.getAdsForRestaurant = getAdsForRestaurant;
//# sourceMappingURL=ad.controller.js.map