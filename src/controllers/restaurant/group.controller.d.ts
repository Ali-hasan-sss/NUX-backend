import { Request, Response } from 'express';
/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Restaurant group management
 */
/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new restaurant group
 *     tags: [Groups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Group created successfully
 *       400:
 *         description: The restaurant already owns a group or is a member of another group
 *       500:
 *         description: Internal server error
 */
export declare const createGroup: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/{groupId}:
 *   put:
 *     summary: Update a restaurant group
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Group updated successfully
 *       403:
 *         description: Only owner can update group
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 */
export declare const updateGroup: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/{groupId}:
 *   get:
 *     summary: Get details of a restaurant group
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group
 *     responses:
 *       200:
 *         description: Group retrieved successfully
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 */
export declare const getGroupDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/members/{groupId}:
 *   get:
 *     summary: Get members of a restaurant group
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group
 *     responses:
 *       200:
 *         description: Group members retrieved successfully
 *       500:
 *         description: Internal server error
 */
export declare const getGroupMembers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/remove:
 *   post:
 *     summary: Remove a restaurant from a group
 *     tags: [Groups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - restaurantId
 *             properties:
 *               groupId:
 *                 type: string
 *               restaurantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Restaurant removed successfully
 *       403:
 *         description: Only owner can remove members
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 */
export declare const removeRestaurantFromGroup: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/invite :
 *   post:
 *     summary: Owner sends a join request to a restaurant
 *     tags: [Groups]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - toRestaurantId
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: The ID of the group owner
 *               toRestaurantId:
 *                 type: string
 *                 description: The restaurant to invite
 *     responses:
 *       200:
 *         description: Join request sent successfully
 *       400:
 *         description: Restaurant already owns a group, is a member, or has pending request
 *       403:
 *         description: Only the owner can send join requests
 *       500:
 *         description: Internal server error
 */
export declare const sendJoinRequest: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/respond/{requestId}:
 *   put:
 *     summary: Accept or reject a join request
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the join request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, REJECTED]
 *     responses:
 *       200:
 *         description: Join request status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Restaurant cannot join (already owns or member of another group)
 *       403:
 *         description: Not authorized to respond to this request
 *       404:
 *         description: Request not found
 *       500:
 *         description: Internal server error
 */
export declare const respondJoinRequest: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @swagger
 * /groups/JoinRequests:
 *   get:
 *     summary: Calculate aggregated balances for a group
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Aggregated balances calculated successfully
 *       400:
 *         description: Group ID is required
 *       500:
 *         description: Internal server error
 */
export declare const getMyJoinRequests: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=group.controller.d.ts.map