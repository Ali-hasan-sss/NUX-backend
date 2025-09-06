import { Request, Response } from 'express';
/**
 * @swagger
 * tags:
 *   - name: Packages
 *     description: CRUD operations for restaurant packages
 */
/**
 * @swagger
 * /restaurants/packages:
 *   get:
 *     summary: Get list of packages for a restaurant
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Packages fetched successfully }
 *       404: { description: Restaurant not found }
 */
export declare const listPackages: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /restaurants/{restaurantId}/packages:
 *   post:
 *     summary: Create a new package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, amount]
 *             properties:
 *               name: { type: string, example: "€50 + €5 bonus" }
 *               amount: { type: number, example: 50 }
 *               bonus: { type: number, example: 5 }
 *               currency: { type: string, example: "EUR" }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               isPublic: { type: boolean }
 *     responses:
 *       201: { description: Package created successfully }
 *       403: { description: Forbidden }
 *       409: { description: Package name already exists for this restaurant }
 */
export declare const createPackage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /restaurants/packages/{id}:
 *   get:
 *     summary: Get a specific package by ID
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     responses:
 *       200: { description: Package fetched successfully }
 *       404: { description: Package not found }
 */
export declare const getPackageById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /restaurants/packages/{id}:
 *   put:
 *     summary: Update a package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               amount: { type: number }
 *               bonus: { type: number }
 *               currency: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               isPublic: { type: boolean }
 *     responses:
 *       200: { description: Package updated successfully }
 *       403: { description: Forbidden }
 *       404: { description: Package not found }
 *       409: { description: Duplicate package name }
 */
export declare const updatePackage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /restaurants/packages/{id}:
 *   delete:
 *     summary: Delete a package
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: int }
 *         required: true
 *     responses:
 *       200: { description: Package deleted successfully }
 *       403: { description: Forbidden }
 *       404: { description: Package not found }
 */
export declare const deletePackage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /api/restaurant/balance/topup:
 *   post:
 *     summary: Restaurant scans user QR and tops up balance
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userQr
 *               - packageId
 *             properties:
 *               userQr:
 *                 type: string
 *                 example: "USER_QR_CODE_123"
 *               packageId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Balance topped up successfully
 *       400:
 *         description: Invalid input or QR code
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export declare const topUpUserBalanceByRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=topupPackages.controller.d.ts.map