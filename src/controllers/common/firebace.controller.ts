// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();
/**
 * @swagger
 * /api/firebase/updateFirebaseToken:
 *   post:
 *     summary: (Deprecated) Update the user's Firebase FCM token
 *     description: |
 *       **Deprecated.** Firebase push notification integration has been discontinued. This endpoint is kept for reference only.
 *       Previously used to store the user's FCM token. Use another notification solution if needed.
 *     deprecated: true
 *     tags: [Firebase]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firebaseToken]
 *             properties:
 *               firebaseToken:
 *                 type: string
 *                 example: "fcm_token_here"
 *                 description: Firebase Cloud Messaging token
 *     responses:
 *       200:
 *         description: Firebase token updated (legacy)
 *       400:
 *         description: Firebase token is missing
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const updateFirebaseToken = async (req: Request, res: Response) => {
  const { firebaseToken } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!firebaseToken) return res.status(400).json({ message: 'Firebase token is required' });

  try {
    await prisma.user.update({ where: { id: userId }, data: { firebaseToken } });
    return successResponse(res, 'Firebase token updated', { firebaseToken: firebaseToken }, 200);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Internal server error', 500);
  }
};
