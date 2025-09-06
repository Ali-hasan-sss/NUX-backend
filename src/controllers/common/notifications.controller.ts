import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get all notifications for the logged-in user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *       403:
 *         description: User not authorized
 */
export const getAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'userId not found', 403);

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, 'notifications fetched successfully', notifications);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /notifications/read/{id}:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Notification ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       403:
 *         description: User not authorized
 *       404:
 *         description: Notification not found
 */
export const markNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) return errorResponse(res, 'userId not found', 403);
    const notificationId = Number(id);
    if (isNaN(notificationId)) return errorResponse(res, 'Invalid notification id', 400);
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      return errorResponse(res, 'notification not found', 404);
    }

    const updatedNotifi = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return successResponse(res, 'notification updated successfully', updatedNotifi);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read for the logged-in user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       403:
 *         description: User not authorized
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'userId not found', 403);

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return successResponse(res, 'all notifications marked as read');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /notifications/count:
 *   get:
 *     summary: Get count of unread notifications for the logged-in user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count of unread notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   example: 5
 *       403:
 *         description: User not authorized
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 'userId not found', 403);

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return successResponse(res, 'unread notifications count fetched', { count });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
