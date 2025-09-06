import { Request, Response } from 'express';
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
export declare const getAdsForAll: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=ads.client.controller.d.ts.map