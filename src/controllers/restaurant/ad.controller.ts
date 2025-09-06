import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { calculateDistance } from '../../utils/check_location';

const prisma = new PrismaClient();

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
export const createAd = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, image, category } = req.body;

    const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    if (restaurant.plan !== 'pro') return errorResponse(res, 'Upgrade to Pro plan to add ads', 403);

    const ad = await prisma.ad.create({
      data: { restaurantId: restaurant.id, title, description, image, category },
    });

    return successResponse(res, 'Ad created successfully', ad);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const updateAd = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, description, image, category } = req.body;

    const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);
    if (!id) return errorResponse(res, 'Ad ID is required', 400);

    const ad = await prisma.ad.findUnique({ where: { id: parseInt(id) } });
    if (!ad) return errorResponse(res, 'Ad not found', 404);
    if (ad.restaurantId !== restaurant.id)
      return errorResponse(res, 'You cannot edit this ad', 403);

    const updatedAd = await prisma.ad.update({
      where: { id: ad.id },
      data: { title, description, image, category },
    });

    return successResponse(res, 'Ad updated successfully', updatedAd);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const deleteAd = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);
    if (!id) return errorResponse(res, 'Ad ID is required', 400);

    const ad = await prisma.ad.findUnique({ where: { id: parseInt(id) } });
    if (!ad) return errorResponse(res, 'Ad not found', 404);
    if (ad.restaurantId !== restaurant.id)
      return errorResponse(res, 'You cannot delete this ad', 403);

    await prisma.ad.delete({ where: { id: ad.id } });

    return successResponse(res, 'Ad deleted successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const getAdsForRestaurant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const restaurant = await prisma.restaurant.findUnique({ where: { userId } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const ads = await prisma.ad.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, 'Restaurant ads fetched successfully', ads);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
