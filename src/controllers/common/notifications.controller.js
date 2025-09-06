"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCount = exports.markAllAsRead = exports.markNotification = exports.getAllNotifications = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
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
const getAllNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return (0, response_1.errorResponse)(res, 'userId not found', 403);
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return (0, response_1.successResponse)(res, 'notifications fetched successfully', notifications);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.getAllNotifications = getAllNotifications;
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
const markNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId)
            return (0, response_1.errorResponse)(res, 'userId not found', 403);
        const notificationId = Number(id);
        if (isNaN(notificationId))
            return (0, response_1.errorResponse)(res, 'Invalid notification id', 400);
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification || notification.userId !== userId) {
            return (0, response_1.errorResponse)(res, 'notification not found', 404);
        }
        const updatedNotifi = await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
        return (0, response_1.successResponse)(res, 'notification updated successfully', updatedNotifi);
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.markNotification = markNotification;
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
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return (0, response_1.errorResponse)(res, 'userId not found', 403);
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        return (0, response_1.successResponse)(res, 'all notifications marked as read');
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.markAllAsRead = markAllAsRead;
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
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return (0, response_1.errorResponse)(res, 'userId not found', 403);
        const count = await prisma.notification.count({
            where: { userId, isRead: false },
        });
        return (0, response_1.successResponse)(res, 'unread notifications count fetched', { count });
    }
    catch (error) {
        console.error(error);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.getUnreadCount = getUnreadCount;
//# sourceMappingURL=notifications.controller.js.map