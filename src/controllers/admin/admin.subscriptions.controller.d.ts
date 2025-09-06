import { Request, Response } from 'express';
/**
 * @swagger
 * tags:
 *   - name: Subscriptions
 *     description: Admin subscriptions management endpoints
 */
/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: Get all subscriptions with optional filters, pagination, and search
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by restaurant name or owner full name
 *       - in: query
 *         name: planId
 *         schema:
 *           type: number
 *         description: Filter by plan ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by subscription status  "PENDING"  "ACTIVE" "CANCELLED"  "EXPIRED"
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: number
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 *       500:
 *         description: Internal server error
 */
export declare const getAllSubscriptions: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /api/admin/subscriptions/cancel/{id}:
 *   put:
 *     summary: Cancel a subscription and notify the restaurant owner
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: Subscription ID to cancel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       400:
 *         description: Subscription cannot be cancelled
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Internal server error
 */
export declare const cancelSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /api/admin/subscriptions/activate:
 *   post:
 *     summary: Activate or extend a subscription for a restaurant
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *               planId:
 *                 type: number
 *                 description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription activated or extended successfully
 *       404:
 *         description: Restaurant or plan not found
 *       500:
 *         description: Internal server error
 */
export declare const activateSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=admin.subscriptions.controller.d.ts.map