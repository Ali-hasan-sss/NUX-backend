// src/services/notification.service.ts
import { PrismaClient } from '@prisma/client';
import { firebaseAdmin } from '../config/firebase';
import { emitToUser } from './socket.service';

const prisma = new PrismaClient();

interface SendNotificationInput {
  userId: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, string>;
}
interface SendNotificationToUsersInput {
  userIds: string[];
  title: string;
  body: string;
  type?: string;
  data?: Record<string, string>;
}

export const sendNotificationToUser = async (input: SendNotificationInput) => {
  const { userId, title, body, type = 'GENERAL', data = {} } = input;

  //  get user Firebase Token
  const user = await prisma.user.findUnique({ where: { id: userId } });
  //  if (!user || !user.firebaseToken) return null;
  console.log('send notification to user');
  // save notification in database
  const notification = await prisma.notification.create({
    data: { userId, title, body, type },
  });

  // emit via WebSocket for real-time delivery (e.g. website dashboard)
  try {
    emitToUser(userId, 'notification', {
      id: notification.id,
      title,
      body,
      type,
      data,
      createdAt: notification.createdAt,
    });
  } catch (_) {}

  // send notification with Firebase (e.g. mobile app when not connected to WebSocket)
  try {
    if (!user?.firebaseToken) {
      console.warn('User has no firebase token');
      return notification;
    }

    await firebaseAdmin.messaging().send({
      token: user.firebaseToken,
      notification: { title, body },
      data,
    });
  } catch (err) {
    console.error('Firebase notification error:', err);
  }

  return notification;
};

//send notification to malti users

export const sendNotificationToUsers = async (input: SendNotificationToUsersInput) => {
  const { userIds, title, body, type = 'GENERAL', data = {} } = input;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, firebaseToken: { not: null } },
  });

  const notifications = await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, title, body, type })),
  });

  // emit via WebSocket to each user for real-time delivery
  users.forEach((u) => {
    try {
      emitToUser(u.id, 'notification', { title, body, type, data });
    } catch (_) {}
  });

  const tokens = users.map((u) => u.firebaseToken).filter((t): t is string => t !== null);

  if (tokens.length > 0) {
    try {
      await firebaseAdmin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
      });
    } catch (err) {
      console.error('Firebase multicast error:', err);
    }
  }

  return notifications;
};

/**
 * Send notification to a list of users. Creates a notification record for every user,
 * then emits WebSocket and sends Firebase push to those with a token.
 */
export const sendNotificationToUsersBulk = async (input: SendNotificationToUsersInput) => {
  const { userIds, title, body, type = 'GENERAL', data = {} } = input;

  if (userIds.length === 0) {
    return { count: 0 };
  }

  // Create notification in DB for every user (so they all see it in their list)
  const createData = userIds.map((userId) => ({ userId, title, body, type }));
  await prisma.notification.createMany({
    data: createData,
  });

  // Get users for WebSocket emit and Firebase (need firebaseToken for push)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firebaseToken: true },
  });

  // Emit via WebSocket to each user for real-time delivery
  users.forEach((u) => {
    try {
      emitToUser(u.id, 'notification', { title, body, type, data });
    } catch (_) {}
  });

  const tokens = users
    .map((u) => u.firebaseToken)
    .filter((t): t is string => t !== null && t !== undefined);

  if (tokens.length > 0) {
    try {
      await firebaseAdmin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data as Record<string, string>,
      });
    } catch (err) {
      console.error('Firebase multicast error:', err);
    }
  }

  return { count: userIds.length };
};
