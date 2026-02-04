import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/admin/restaurants/with-owner:
 *   post:
 *     summary: Create a new restaurant with a new owner account in one step
 *     description: Creates a RESTAURANT_OWNER user, a restaurant linked to that user, and optionally an active subscription for the given plan. All in a single transaction.
 *     tags: [Restaurants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - address
 *               - latitude
 *               - longitude
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Owner account email
 *               password:
 *                 type: string
 *                 description: Owner account password (will be hashed)
 *               fullName:
 *                 type: string
 *                 description: Owner full name (optional)
 *               name:
 *                 type: string
 *                 description: Restaurant name
 *               address:
 *                 type: string
 *                 description: Restaurant address
 *               latitude:
 *                 type: number
 *                 description: Restaurant latitude
 *               longitude:
 *                 type: number
 *                 description: Restaurant longitude
 *               planId:
 *                 type: number
 *                 description: Optional plan ID to activate a subscription for the restaurant
 *     responses:
 *       201:
 *         description: Restaurant and owner created successfully
 *       400:
 *         description: Validation error or email already registered
 *       404:
 *         description: Plan not found (when planId is provided)
 *       500:
 *         description: Internal server error
 */
export const createRestaurantWithOwner = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, name, address, latitude, longitude, planId } = req.body;

    if (
      !email ||
      !password ||
      !name ||
      !address ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return errorResponse(
        res,
        'Email, password, restaurant name, address, latitude and longitude are required',
        400,
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email: String(email).trim() } });
    if (existingUser) {
      return errorResponse(res, 'Email already registered', 400);
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        email: String(email).trim(),
        password: hashedPassword,
        fullName: fullName ? String(fullName).trim() : null,
        role: 'RESTAURANT_OWNER',
        isRestaurant: true,
        isActive: true,
        qrCode: uuidv4(),
      },
    });

    type SubCreate = Prisma.SubscriptionCreateWithoutRestaurantInput;
    let subscriptionCreate: SubCreate | undefined;
    if (planId != null && planId !== '') {
      const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
      if (!plan) {
        await prisma.user.delete({ where: { id: user.id } });
        return errorResponse(res, 'Plan not found', 404);
      }
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(now.getDate() + plan.duration);
      subscriptionCreate = {
        startDate: now,
        endDate,
        status: 'ACTIVE',
        paymentStatus: 'paid',
        paymentMethod: 'admin_activation',
        plan: { connect: { id: plan.id } },
      };
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name: String(name).trim(),
        address: String(address).trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        owner: { connect: { id: user.id } },
        ...(subscriptionCreate && {
          subscriptions: { create: subscriptionCreate },
          isSubscriptionActive: true,
        }),
      },
      include: {
        owner: {
          select: { id: true, email: true, fullName: true, isActive: true, createdAt: true },
        },
        subscriptions: { include: { plan: true } },
      },
    });

    return successResponse(res, 'Restaurant and owner created successfully', restaurant, 201);
  } catch (error) {
    console.error('createRestaurantWithOwner error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * tags:
 *   - name: Restaurants
 *     description: Admin restaurants management endpoints
 */

/**
 * @swagger
 * /api/admin/restaurants:
 *   get:
 *     summary: Get all restaurants
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         search: name
 *         schema:
 *           type: string
 *         description: Search restaurants by name or owner email
 *       - in: query
 *         name: planId
 *         schema:
 *           type: number
 *         description: Filter by plan
 *       - in: query
 *         name: subscriptionActive
 *         schema:
 *           type: boolean
 *         description: Filter by subscription status
 *     responses:
 *       200:
 *         description: Restaurants retrieved successfully
 *       500:
 *         description: Internal server error
 */
export const getAllRestaurants = async (req: Request, res: Response) => {
  try {
    const { search, planId, subscriptionActive, page = '1', pageSize = '10' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { owner: { email: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    if (subscriptionActive !== undefined) {
      where.isSubscriptionActive = subscriptionActive === 'true';
    }

    if (planId && planId !== 'all') {
      const planIdNum = Number(planId);
      if (!isNaN(planIdNum)) {
        where.subscriptions = {
          some: { planId: planIdNum },
        };
      }
    }

    // Pagination
    const pageNumber = Math.max(parseInt(page as string, 10), 1);
    const size = Math.max(parseInt(pageSize as string, 10), 1);
    const skip = (pageNumber - 1) * size;

    const totalItems = await prisma.restaurant.count({ where });
    const totalPages = Math.ceil(totalItems / size);

    const items = await prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true, isActive: true } },
        subscriptions: { include: { plan: true } },
      },
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, 'Restaurants retrieved successfully', {
      items,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: size,
      },
    });
  } catch (error) {
    console.error('Get all restaurants error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/restaurants/{id}:
 *   get:
 *     summary: Get restaurant by ID
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
 *       404:
 *         description: Restaurant not found
 */
export const getRestaurantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isRestaurant: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        purchases: true,
        payments: true,
      },
    });

    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    return successResponse(res, 'Restaurant retrieved successfully', restaurant);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/restaurants:
 *   post:
 *     summary: Create a new restaurant
 *     tags: [Restaurants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - latitude
 *               - longitude
 *               - userId
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the restaurant
 *               address:
 *                 type: string
 *                 description: Address of the restaurant
 *               latitude:
 *                 type: number
 *                 description: Latitude coordinate
 *               longitude:
 *                 type: number
 *                 description: Longitude coordinate
 *               userId:
 *                 type: string
 *                 description: Owner user ID
 *               planId:
 *                 type: number
 *                 description: Optional plan ID to assign to the restaurant
 *               subscriptionActive:
 *                 type: boolean
 *                 description: Optional flag to indicate if subscription is active
 *     responses:
 *       201:
 *         description: Restaurant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 */

export const createRestaurant = async (req: Request, res: Response) => {
  try {
    const { name, address, latitude, longitude, userId, planId } = req.body;

    const owner = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (!owner) return errorResponse(res, 'Owner user not found', 404);

    let planRelation = null;
    if (planId) {
      const planExists = await prisma.plan.findUnique({ where: { id: Number(planId) } });
      if (!planExists) return errorResponse(res, 'Plan not found', 404);

      planRelation = { connect: { id: planExists.id } };
    }

    let subscriptionData: Prisma.SubscriptionCreateNestedManyWithoutRestaurantInput | undefined =
      undefined;

    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
      if (plan) {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + plan.duration);

        subscriptionData = {
          create: {
            startDate: now,
            endDate,
            status: 'ACTIVE',
            plan: { connect: { id: plan.id } },
          },
        };
      }
    }

    const data: any = {
      name,
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      owner: { connect: { id: owner.id } },
    };

    if (subscriptionData) {
      data.currentSubscription = subscriptionData;
    }

    const restaurant = await prisma.restaurant.create({
      data,
      include: {
        subscriptions: { include: { plan: true } },
        owner: true,
      },
    });

    return successResponse(res, 'Restaurant created successfully', restaurant, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/restaurants/{id}:
 *   put:
 *     summary: Update a restaurant
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated name of the restaurant
 *               address:
 *                 type: string
 *                 description: Updated address
 *               latitude:
 *                 type: number
 *                 description: Updated latitude
 *               longitude:
 *                 type: number
 *                 description: Updated longitude
 *               planId:
 *                 type: number
 *                 description: Updated plan ID
 *               subscriptionActive:
 *                 type: boolean
 *                 description: Updated subscription active status
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 */

export const updateRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, planId } = req.body;

    // Ensure restaurant ID exists in the request
    if (!id) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }

    // Find restaurant with its subscriptions
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { subscriptions: { include: { plan: true } } },
    });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    // Update restaurant's basic info
    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name: name ?? restaurant.name,
        address: address ?? restaurant.address,
        latitude: latitude !== undefined ? Number(latitude) : restaurant.latitude,
        longitude: longitude !== undefined ? Number(longitude) : restaurant.longitude,
      },
    });

    let newSubscription = null;

    // If a new plan is provided in the request
    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
      if (!plan) return errorResponse(res, 'Plan not found', 404);

      // Calculate subscription start and end dates
      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(now.getMonth() + plan.duration); // Duration in months

      // Create a new subscription linked to the restaurant
      newSubscription = await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plan.id,
          startDate: now,
          endDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
        },
        include: { plan: true },
      });
    }

    // Fetch restaurant again to include updated subscriptions
    const result = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        owner: true,
        subscriptions: { include: { plan: true } },
      },
    });

    // Return updated restaurant data + latest subscription if created
    return successResponse(res, 'Restaurant updated successfully', {
      ...result,
      latestSubscription: newSubscription,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/restaurants/{id}:
 *   delete:
 *     summary: Delete a restaurant and its owner account
 *     description: Deletes all dependent records (subscriptions, balances, payments, purchases, invoices), then the restaurant, then the owner user account. This action cannot be undone.
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant and owner deleted successfully
 *       400:
 *         description: Restaurant ID is required
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
export const deleteRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return errorResponse(res, 'Restaurant ID is required', 400);
    }
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) return errorResponse(res, 'Restaurant not found', 404);

    const ownerId = restaurant.userId;

    // Delete dependent records first (no DB cascade), then restaurant, then owner
    await prisma.subscription.deleteMany({ where: { restaurantId: id } });
    await prisma.userRestaurantBalance.deleteMany({
      where: { restaurantId: id },
    });
    await prisma.payment.deleteMany({ where: { restaurantId: id } });
    await prisma.purchase.deleteMany({ where: { restaurantId: id } });
    await prisma.invoice.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurant.delete({ where: { id } });
    await prisma.user.delete({ where: { id: ownerId } });

    return successResponse(res, 'Restaurant and owner deleted successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
