import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { calculateDistance } from '../../utils/check_location';

const prisma = new PrismaClient();

/**
 * @swagger
 * /ads:
 *   get:
 *     summary: Get all ads for users with restaurant info and optional filters
 *     description: >
 *       Retrieve a list of all ads including basic restaurant info (name, id, coordinates).
 *       Optional filters can be applied:
 *         - `category`: Filter ads by category (e.g., food, drink)
 *         - `search`: Search ads by title or description (case-insensitive)
 *         - `lat`, `lng`, `radius`: Filter ads by proximity to given coordinates (radius in km)
 *     tags: [Ads]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter ads by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search ads by title or description
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         required: false
 *         description: User's latitude for proximity filtering
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         required: false
 *         description: User's longitude for proximity filtering
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         required: false
 *         description: Radius in kilometers to filter nearby ads
 *     responses:
 *       200:
 *         description: List of ads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Ad ID
 *                   title:
 *                     type: string
 *                     description: Ad title
 *                   description:
 *                     type: string
 *                     description: Ad description
 *                   image:
 *                     type: string
 *                     description: Ad image URL
 *                   category:
 *                     type: string
 *                     description: Ad category
 *                   restaurant:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Restaurant ID
 *                       name:
 *                         type: string
 *                         description: Restaurant name
 *                       latitude:
 *                         type: number
 *                         description: Restaurant latitude
 *                       longitude:
 *                         type: number
 *                         description: Restaurant longitude
 */

export const getAdsForAll = async (req: Request, res: Response) => {
  try {
    const { category, search, lat, lng, radius } = req.query;

    const filters: any = {};
    if (category) filters.category = category;
    if (search) {
      filters.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let ads = await prisma.ad.findMany({
      orderBy: { createdAt: 'desc' },
      where: filters,
      include: {
        restaurant: {
          select: { id: true, name: true, latitude: true, longitude: true },
        },
      },
    });

    if (lat && lng && radius) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const r = parseFloat(radius as string);

      ads = ads.filter((ad) => {
        const distance = calculateDistance(
          userLat,
          userLng,
          ad.restaurant.latitude,
          ad.restaurant.longitude,
        );
        return distance / 1000 <= r;
      });
    }

    return successResponse(res, 'Ads fetched successfully', ads);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
