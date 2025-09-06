import { Request, Response } from 'express';
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
export declare const getAllRestaurants: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const getRestaurantById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const createRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const updateRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const deleteRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=admin.restaurant.controller.d.ts.map