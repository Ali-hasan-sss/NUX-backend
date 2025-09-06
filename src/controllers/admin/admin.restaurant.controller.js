"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRestaurant = exports.updateRestaurant = exports.createRestaurant = exports.getRestaurantById = exports.getAllRestaurants = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
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
const getAllRestaurants = async (req, res) => {
    try {
        const { search, planId, subscriptionActive, page = '1', pageSize = '10' } = req.query;
        const where = {};
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
        const pageNumber = Math.max(parseInt(page, 10), 1);
        const size = Math.max(parseInt(pageSize, 10), 1);
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
        return (0, response_1.successResponse)(res, 'Restaurants retrieved successfully', {
            items,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNumber,
                pageSize: size,
            },
        });
    }
    catch (error) {
        console.error('Get all restaurants error:', error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.getAllRestaurants = getAllRestaurants;
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
const getRestaurantById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, response_1.errorResponse)(res, 'Restaurant ID is required', 400);
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
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        return (0, response_1.successResponse)(res, 'Restaurant retrieved successfully', restaurant);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.getRestaurantById = getRestaurantById;
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
const createRestaurant = async (req, res) => {
    try {
        const { name, address, latitude, longitude, userId, planId } = req.body;
        const owner = await prisma.user.findUnique({ where: { id: String(userId) } });
        if (!owner)
            return (0, response_1.errorResponse)(res, 'Owner user not found', 404);
        let planRelation = null;
        if (planId) {
            const planExists = await prisma.plan.findUnique({ where: { id: Number(planId) } });
            if (!planExists)
                return (0, response_1.errorResponse)(res, 'Plan not found', 404);
            planRelation = { connect: { id: planExists.id } };
        }
        let subscriptionData = undefined;
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
        const data = {
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
        return (0, response_1.successResponse)(res, 'Restaurant created successfully', restaurant, 201);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.createRestaurant = createRestaurant;
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
const updateRestaurant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, latitude, longitude, planId } = req.body;
        // Ensure restaurant ID exists in the request
        if (!id) {
            return (0, response_1.errorResponse)(res, 'Restaurant ID is required', 400);
        }
        // Find restaurant with its subscriptions
        const restaurant = await prisma.restaurant.findUnique({
            where: { id },
            include: { subscriptions: { include: { plan: true } } },
        });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
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
            if (!plan)
                return (0, response_1.errorResponse)(res, 'Plan not found', 404);
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
        return (0, response_1.successResponse)(res, 'Restaurant updated successfully', {
            ...result,
            latestSubscription: newSubscription,
        });
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.updateRestaurant = updateRestaurant;
/**
 * @swagger
 * /api/admin/restaurants/{id}:
 *   delete:
 *     summary: Delete a restaurant
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
 *         description: Restaurant deleted successfully
 */
const deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, response_1.errorResponse)(res, 'Restaurant ID is required', 400);
        }
        const restaurant = await prisma.restaurant.findUnique({ where: { id } });
        if (!restaurant)
            return (0, response_1.errorResponse)(res, 'Restaurant not found', 404);
        await prisma.restaurant.delete({ where: { id } });
        return (0, response_1.successResponse)(res, 'Restaurant deleted successfully');
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.deleteRestaurant = deleteRestaurant;
//# sourceMappingURL=admin.restaurant.controller.js.map