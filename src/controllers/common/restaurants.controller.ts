import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/restaurants:
 *   get:
 *     summary: Get all restaurants with public information
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of restaurants per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by restaurant name
 *     responses:
 *       200:
 *         description: Restaurants retrieved successfully
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
 *                     restaurants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           logo:
 *                             type: string
 *                             nullable: true
 *                           address:
 *                             type: string
 *                           latitude:
 *                             type: number
 *                           longitude:
 *                             type: number
 *                           isActive:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       500:
 *         description: Internal server error
 */
export const getAllRestaurants = async (req: Request, res: Response) => {
  console.log('🔍 getAllRestaurants called - GET /api/restaurants');
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Get restaurants with pagination
    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          latitude: true,
          longitude: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.restaurant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 'Restaurants retrieved successfully', {
      restaurants,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return errorResponse(res, 'Failed to fetch restaurants', 500);
  }
};

/**
 * @swagger
 * /api/restaurants/{id}:
 *   get:
 *     summary: Get a specific restaurant by ID with public information
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant retrieved successfully
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                     address:
 *                       type: string
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
export const getRestaurantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: {
        id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found', 404);
    }

    return successResponse(res, 'Restaurant retrieved successfully', restaurant);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return errorResponse(res, 'Failed to fetch restaurant', 500);
  }
};

/**
 * @swagger
 * /api/restaurants/nearby:
 *   get:
 *     summary: Get restaurants near a specific location
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Search radius in kilometers
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of restaurants to return
 *     responses:
 *       200:
 *         description: Nearby restaurants retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       logo:
 *                         type: string
 *                         nullable: true
 *                       address:
 *                         type: string
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *                       distance:
 *                         type: number
 *                         description: Distance in kilometers
 *       400:
 *         description: Invalid coordinates
 *       500:
 *         description: Internal server error
 */
export const getNearbyRestaurants = async (req: Request, res: Response) => {
  try {
    const latitude = parseFloat(req.query.latitude as string);
    const longitude = parseFloat(req.query.longitude as string);
    const radius = parseFloat(req.query.radius as string) || 10;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (isNaN(latitude) || isNaN(longitude)) {
      return errorResponse(res, 'Valid latitude and longitude are required', 400);
    }

    // Get all active restaurants
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Calculate distances and filter by radius
    const restaurantsWithDistance = restaurants
      .map((restaurant) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          restaurant.latitude,
          restaurant.longitude,
        );
        return {
          ...restaurant,
          distance,
        };
      })
      .filter((restaurant) => restaurant.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return successResponse(
      res,
      'Nearby restaurants retrieved successfully',
      restaurantsWithDistance,
    );
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return errorResponse(res, 'Failed to fetch nearby restaurants', 500);
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
