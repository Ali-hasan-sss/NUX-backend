import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { calculateDistance } from '../../utils/check_location';

const prisma = new PrismaClient();

/**
 * @swagger
 * /ads:
 *   get:
 *     summary: Get all ads for users with restaurant info and optional filters with pagination
 *     description: >
 *       Retrieve a list of all ads including basic restaurant info (name, id, coordinates).
 *       Optional filters can be applied:
 *         - `category`: Filter ads by category (e.g., food, drink)
 *         - `search`: Search ads by title or description (case-insensitive)
 *         - `lat`, `lng`, `radius`: Filter ads by proximity to given coordinates (radius in km)
 *         - `page`, `pageSize`: Pagination parameters
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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of ads with pagination info
 *       500:
 *         description: Internal server error
 */

export const getAdsForAll = async (req: Request, res: Response) => {
  try {
    const { category, search, lat, lng, radius, page, pageSize } = req.query;

    // Pagination parameters
    const currentPage = parseInt(page as string) || 1;
    const itemsPerPage = parseInt(pageSize as string) || 10;

    const filters: any = {
      restaurant: {
        isActive: true, // Only show ads from active restaurants
      },
    };

    if (category) filters.category = category;
    if (search) {
      filters.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // If proximity filter is provided, fetch all ads first, then filter
    let ads;
    let totalItems;

    if (lat && lng && radius) {
      // Fetch all matching ads (without pagination) for proximity filtering
      const allAds = await prisma.ad.findMany({
        where: filters,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
              logo: true,
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const r = parseFloat(radius as string);

      // Filter by proximity
      const filteredAds = allAds.filter((ad) => {
        const distance = calculateDistance(
          userLat,
          userLng,
          ad.restaurant.latitude,
          ad.restaurant.longitude,
        );
        return distance / 1000 <= r;
      });

      totalItems = filteredAds.length;

      // Apply pagination to filtered results
      const startIndex = (currentPage - 1) * itemsPerPage;
      ads = filteredAds.slice(startIndex, startIndex + itemsPerPage);
    } else {
      // No proximity filter - use database pagination
      totalItems = await prisma.ad.count({ where: filters });

      ads = await prisma.ad.findMany({
        where: filters,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
              logo: true,
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * itemsPerPage,
        take: itemsPerPage,
      });
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return successResponse(res, 'Ads fetched successfully', {
      pagination: {
        totalItems,
        totalPages,
        currentPage,
        pageSize: itemsPerPage,
      },
      ads,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /ads/restaurant/{restaurantId}/packages:
 *   get:
 *     summary: Get all top-up packages for a specific restaurant
 *     description: Retrieve all active top-up packages for a given restaurant
 *     tags: [Ads]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: List of packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     restaurant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         logo:
 *                           type: string
 *                     packages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           bonus:
 *                             type: number
 *                           currency:
 *                             type: string
 *                           description:
 *                             type: string
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
export const getRestaurantPackages = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }

    // Check if restaurant exists and is active
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        logo: true,
        isActive: true,
      },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    if (!restaurant.isActive) {
      return errorResponse(res, 'Restaurant is not active', 403);
    }

    // Get all public active packages for this restaurant
    const packages = await prisma.topUpPackage.findMany({
      where: {
        restaurantId,
        isActive: true,
        isPublic: true,
      },
      orderBy: { amount: 'asc' },
      select: {
        id: true,
        name: true,
        amount: true,
        bonus: true,
        currency: true,
        description: true,
        createdAt: true,
      },
    });

    return successResponse(res, 'Packages fetched successfully', {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logo: restaurant.logo,
      },
      packages,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
