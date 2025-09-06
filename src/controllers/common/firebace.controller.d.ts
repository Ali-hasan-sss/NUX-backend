import { Request, Response } from 'express';
/**
 * @swagger
 * /firebase/updateFirebaseToken:
 *   post:
 *     summary: Update the user's Firebase token for push notifications
 *     tags: [firebase]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firebaseToken
 *             properties:
 *               firebaseToken:
 *                 type: string
 *                 example: "fcm_token_here"
 *     responses:
 *       200:
 *         description: Firebase token updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Firebase token updated
 *       400:
 *         description: Firebase token is missing
 *       401:
 *         description: Unauthorized (user not authenticated)
 */
export declare const updateFirebaseToken: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=firebace.controller.d.ts.map