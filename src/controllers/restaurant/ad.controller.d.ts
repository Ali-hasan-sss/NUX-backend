import { Request, Response } from 'express';
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
export declare const createAd: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const updateAd: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const deleteAd: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const getAdsForRestaurant: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=ad.controller.d.ts.map