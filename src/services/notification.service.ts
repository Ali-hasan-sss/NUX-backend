// src/services/notification.service.ts
import { PrismaClient } from '@prisma/client';
import { firebaseAdmin } from '../config/firebase';
// import { firebaseAdmin } from '../utils/firebase';

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

  // send notification with Firebase
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
