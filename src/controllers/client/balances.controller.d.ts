import { Request, Response } from 'express';
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
export declare const getUserRestaurantsWithBalance: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const listPublicPackages: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const scanQrCode: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const payAtRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const giftBalance: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=balances.controller.d.ts.map