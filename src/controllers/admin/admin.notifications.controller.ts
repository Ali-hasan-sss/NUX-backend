import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { sendNotificationToUsersBulk } from '../../services/notification.service';

const prisma = new PrismaClient();

export type AdminNotificationAudience = 'all' | 'restaurant_owners' | 'subadmins';

/**
 * @swagger
 * /api/admin/notifications/send:
 *   post:
 *     summary: Send notification to an audience (admin only)
 *     description: Sends a notification to all users, restaurant owners only, or sub-admins only.
 *     tags: [Admin Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *               - audience
 *             properties:
 *               title:
 *                 type: string
 *                 description: Notification title
 *               body:
 *                 type: string
 *                 description: Notification body
 *               audience:
 *                 type: string
 *                 enum: [all, restaurant_owners, subadmins]
 *                 description: Target audience - all users, restaurant owners only, or sub-admins only
 *     responses:
 *       200:
 *         description: Notifications sent successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
export const sendAdminNotification = async (req: Request, res: Response) => {
  try {
    const { title, body, audience } = req.body as {
      title?: string;
      body?: string;
      audience?: AdminNotificationAudience;
    };

    if (!title || typeof title !== 'string' || !title.trim()) {
      return errorResponse(res, 'Title is required', 400);
    }
    if (!body || typeof body !== 'string') {
      return errorResponse(res, 'Body is required', 400);
    }
    const validAudiences: AdminNotificationAudience[] = ['all', 'restaurant_owners', 'subadmins'];
    if (!audience || !validAudiences.includes(audience)) {
      return errorResponse(res, 'Audience must be one of: all, restaurant_owners, subadmins', 400);
    }

    let userIds: string[] = [];

    if (audience === 'all') {
      const users = await prisma.user.findMany({
        where: {},
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (audience === 'restaurant_owners') {
      const users = await prisma.user.findMany({
        where: { role: 'RESTAURANT_OWNER' },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (audience === 'subadmins') {
      const subAdmins = await prisma.subAdmin.findMany({
        select: { userId: true },
      });
      userIds = subAdmins.map((s) => s.userId);
    }

    if (userIds.length === 0) {
      return successResponse(res, 'No users in the selected audience', { count: 0 });
    }

    const result = await sendNotificationToUsersBulk({
      userIds,
      title: title.trim(),
      body: typeof body === 'string' ? body : String(body),
      type: 'ADMIN_BROADCAST',
    });

    return successResponse(res, 'Notifications sent successfully', result);
  } catch (error) {
    console.error('sendAdminNotification error:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
