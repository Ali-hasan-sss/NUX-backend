"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationToUsers = exports.sendNotificationToUser = void 0;
// src/services/notification.service.ts
const client_1 = require("@prisma/client");
const firebase_1 = require("../config/firebase");
// import { firebaseAdmin } from '../utils/firebase';
const prisma = new client_1.PrismaClient();
const sendNotificationToUser = async (input) => {
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
        await firebase_1.firebaseAdmin.messaging().send({
            token: user.firebaseToken,
            notification: { title, body },
            data,
        });
    }
    catch (err) {
        console.error('Firebase notification error:', err);
    }
    return notification;
};
exports.sendNotificationToUser = sendNotificationToUser;
//send notification to malti users
const sendNotificationToUsers = async (input) => {
    const { userIds, title, body, type = 'GENERAL', data = {} } = input;
    const users = await prisma.user.findMany({
        where: { id: { in: userIds }, firebaseToken: { not: null } },
    });
    const notifications = await prisma.notification.createMany({
        data: users.map((u) => ({ userId: u.id, title, body, type })),
    });
    const tokens = users.map((u) => u.firebaseToken).filter((t) => t !== null);
    if (tokens.length > 0) {
        try {
            await firebase_1.firebaseAdmin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data,
            });
        }
        catch (err) {
            console.error('Firebase multicast error:', err);
        }
    }
    return notifications;
};
exports.sendNotificationToUsers = sendNotificationToUsers;
//# sourceMappingURL=notification.service.js.map