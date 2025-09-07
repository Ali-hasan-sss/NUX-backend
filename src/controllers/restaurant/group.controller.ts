// controllers/groupController.ts

import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { sendNotificationToUser } from '../../services/notification.service';

const prisma = new PrismaClient();

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
export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    if (!userId) return errorResponse(res, 'user not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found for this user', 404);
    }

    const ownerId = restaurant.id;

    const existingOwnedGroup = await prisma.restaurantGroup.findFirst({ where: { ownerId } });
    if (existingOwnedGroup) {
      return errorResponse(
        res,
        'This restaurant already owns a group, cannot create more than one',
        400,
      );
    }

    const existingMembership = await prisma.groupMembership.findFirst({
      where: { restaurantId: ownerId },
    });
    if (existingMembership) {
      return errorResponse(res, 'This restaurant is already a member of another group', 400);
    }

    const group = await prisma.restaurantGroup.create({
      data: { name, description, ownerId },
    });

    // mark restaurant as group member/owner
    try {
      await prisma.restaurant.update({ where: { id: ownerId }, data: { isGroupMember: true } });
    } catch (e) {
      console.error('Failed to update isGroupMember for owner:', e);
    }

    return successResponse(res, 'Group created successfully', group);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    if (!groupId) return errorResponse(res, 'Group ID is required', 400);
    const userId = req.user!.id;

    if (!userId) return errorResponse(res, 'user not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found for this user', 404);
    }

    const ownerId = restaurant.id;
    const group = await prisma.restaurantGroup.findUnique({ where: { id: groupId } });
    if (!group) return errorResponse(res, 'Group not found', 404);
    if (group.ownerId !== ownerId) return errorResponse(res, 'Only owner can update group', 403);

    const updated = await prisma.restaurantGroup.update({
      where: { id: groupId },
      data: { name, description },
    });
    return successResponse(res, 'Group updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const getGroupDetails = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    if (!groupId) return errorResponse(res, 'Group ID is required', 400);

    const group = await prisma.restaurantGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        owner: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        members: {
          select: {
            restaurant: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        joinRequests: {
          select: {
            id: true,
            createdAt: true,
            toRestaurantId: true,
          },
        },
      },
    });

    if (!group) return errorResponse(res, 'Group not found', 404);

    return successResponse(res, 'Group retrieved successfully', group);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const getGroupMembers = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    if (!groupId) return errorResponse(res, 'Group ID is required', 400);

    const group = await prisma.restaurantGroup.findUnique({
      where: { id: groupId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        members: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });

    if (!group) return errorResponse(res, 'Group not found', 404);

    return successResponse(res, 'Group members retrieved successfully', {
      owner: group.owner,
      members: group.members.map((m) => ({
        id: m.restaurant.id,
        name: m.restaurant.name,
        address: m.restaurant.address,
      })),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const removeRestaurantFromGroup = async (req: Request, res: Response) => {
  try {
    const { groupId, restaurantId } = req.body;
    const userId = req.user!.id;

    if (!userId) return errorResponse(res, 'User not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found for this user', 404);
    }

    const ownerId = restaurant.id;

    const group = await prisma.restaurantGroup.findUnique({ where: { id: groupId } });
    if (!group) return errorResponse(res, 'Group not found', 404);
    if (group.ownerId !== ownerId) return errorResponse(res, 'Only owner can remove members', 403);

    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_restaurantId: { groupId, restaurantId } },
    });

    if (!membership) {
      return errorResponse(res, 'Restaurant is not a member of this group', 404);
    }

    await prisma.groupMembership.delete({
      where: { groupId_restaurantId: { groupId, restaurantId } },
    });

    return successResponse(res, 'Restaurant removed successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const sendJoinRequest = async (req: Request, res: Response) => {
  try {
    const { groupId, toRestaurantId } = req.body;
    const userId = req.user!.id;

    if (!userId) return errorResponse(res, 'user not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return errorResponse(res, 'Restaurant not found for this user', 404);
    }

    const ownerId = restaurant.id;

    // check if group exists and owner is correct
    const group = await prisma.restaurantGroup.findUnique({ where: { id: groupId } });
    if (!group) return errorResponse(res, 'Group not found', 404);
    if (group.ownerId !== ownerId)
      return errorResponse(res, 'Only the owner can send join requests', 403);

    // check if target restaurant already owns a group
    const ownedGroup = await prisma.restaurantGroup.findFirst({
      where: { ownerId: toRestaurantId },
    });
    if (ownedGroup)
      return errorResponse(res, 'This restaurant already owns a group and cannot be invited', 400);

    // check if target restaurant already member
    const membership = await prisma.groupMembership.findFirst({
      where: { restaurantId: toRestaurantId },
    });
    if (membership)
      return errorResponse(res, 'This restaurant is already a member of another group', 400);

    // check existing pending request
    const existingRequest = await prisma.groupJoinRequest.findFirst({
      where: { groupId, toRestaurantId, status: 'PENDING' },
    });
    if (existingRequest)
      return errorResponse(res, 'There is already a pending request for this restaurant', 400);

    // get sender and target restaurants
    const [senderRestaurant, targetRestaurant] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: ownerId },
        select: { name: true },
      }),
      prisma.restaurant.findUnique({
        where: { id: toRestaurantId },
        select: { name: true, userId: true },
      }),
    ]);

    // create request
    const request = await prisma.groupJoinRequest.create({
      data: { groupId, fromRestaurantId: ownerId, toRestaurantId, status: 'PENDING' },
    });

    // send notification to the target restaurant
    if (targetRestaurant && senderRestaurant) {
      await sendNotificationToUser({
        userId: targetRestaurant.userId,
        title: 'Group Join Invitation',
        body: `You have received an invitation from ${senderRestaurant.name} to join the group ${group.name}`,
        type: 'GROUP_INVITE',
        data: {
          requestId: request.id.toString(),
          groupId,
          fromRestaurantName: senderRestaurant.name,
          toRestaurantName: targetRestaurant.name,
          groupName: group.name,
        },
      });
    }

    // return response with names and requestId
    return successResponse(res, 'Join request sent successfully', {
      request,
      requestId: request.id,
      fromRestaurantName: senderRestaurant?.name,
      toRestaurantName: targetRestaurant?.name,
      groupName: group.name,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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

export const respondJoinRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;

    if (!userId) return errorResponse(res, 'User not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });
    if (!restaurant) return errorResponse(res, 'Restaurant not found for this user', 404);

    const restaurantId = restaurant.id;

    const request = await prisma.groupJoinRequest.findUnique({
      where: { id: Number(requestId) },
    });
    if (!request) return errorResponse(res, 'Request not found', 404);

    if (request.toRestaurantId !== restaurantId)
      return errorResponse(res, 'Not authorized to respond to this request', 403);

    const group = await prisma.restaurantGroup.findUnique({
      where: { id: request.groupId },
      include: { owner: true },
    });
    if (!group) return errorResponse(res, 'Group not found', 404);

    const senderRestaurant = await prisma.restaurant.findUnique({
      where: { id: request.fromRestaurantId },
      select: { name: true, userId: true },
    });

    if (status === 'ACCEPTED') {
      const ownedGroup = await prisma.restaurantGroup.findFirst({
        where: { ownerId: restaurantId },
      });
      if (ownedGroup)
        return errorResponse(res, 'This restaurant already owns a group and cannot join', 400);

      const membership = await prisma.groupMembership.findFirst({ where: { restaurantId } });
      if (membership)
        return errorResponse(res, 'This restaurant is already a member of another group', 400);

      await prisma.groupMembership.create({ data: { groupId: request.groupId, restaurantId } });
      // mark restaurant as group member
      try {
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: { isGroupMember: true },
        });
      } catch (e) {
        console.error('Failed to update isGroupMember for member:', e);
      }
    }

    const updated = await prisma.groupJoinRequest.update({
      where: { id: Number(requestId) },
      data: { status, respondedAt: new Date() },
    });

    if (status === 'ACCEPTED' && senderRestaurant) {
      await sendNotificationToUser({
        userId: senderRestaurant.userId,
        title: 'Group Join Request Accepted',
        body: `${restaurant.name} has accepted your request to join the group "${group.name}"`,
        type: 'GROUP_INVITE',
        data: {
          requestId: request.id.toString(),
          groupId: group.id,
          fromRestaurantName: senderRestaurant.name,
          toRestaurantName: restaurant.name,
          groupName: group.name,
        },
      });
    }

    return successResponse(res, 'Join request status updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

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
export const getMyJoinRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!userId) return errorResponse(res, 'User not found', 403);

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });
    if (!restaurant) return errorResponse(res, 'Restaurant not found for this user', 404);

    const restaurantId = restaurant.id;

    const requests = await prisma.groupJoinRequest.findMany({
      where: { toRestaurantId: restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    const detailedRequests = await Promise.all(
      requests.map(async (r) => {
        const group = await prisma.restaurantGroup.findUnique({
          where: { id: r.groupId },
          select: { id: true, name: true, description: true, ownerId: true },
        });

        const fromRestaurant = await prisma.restaurant.findUnique({
          where: { id: r.fromRestaurantId },
          select: { id: true, name: true },
        });

        return {
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
          group,
          fromRestaurant,
        };
      }),
    );

    return successResponse(res, 'Join requests retrieved successfully', detailedRequests);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
