import { Request, Response } from 'express';
/**
 * @swagger
 * /api/restaurants/account/update:
 *   put:
 *     summary: Update own restaurant
 *     tags: [Restaurant account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logo:
 *                 type: string
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *       404:
 *         description: Restaurant not found
 */
export declare const updateRestaurantByOwner: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=restaurant.info.controller.d.ts.map