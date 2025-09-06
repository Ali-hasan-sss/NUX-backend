import { Request, Response } from 'express';
/**
 * @swagger
 * /customer/menu/{qrCode}:
 *   get:
 *     summary: Get all menu categories of a restaurant by QR code (restaurant ID)
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the restaurant from QR code
 *     responses:
 *       200:
 *         description: Successfully retrieved categories
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export declare const getCategoriesByQRCode: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * @swagger
 * /customer/menu/items/{categoryId}:
 *   get:
 *     summary: Get all menu items for a specific category by categoryId
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to fetch items
 *     responses:
 *       200:
 *         description: Successfully retrieved menu items
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export declare const getItemsByCategoryForCustomer: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=menuClient.controller.d.ts.map