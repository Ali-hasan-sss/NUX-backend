"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFirebaseToken = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
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
const updateFirebaseToken = async (req, res) => {
    const { firebaseToken } = req.body;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    if (!firebaseToken)
        return res.status(400).json({ message: 'Firebase token is required' });
    try {
        await prisma.user.update({ where: { id: userId }, data: { firebaseToken } });
        return (0, response_1.successResponse)(res, 'Firebase token updated', { firebaseToken: firebaseToken }, 200);
    }
    catch (err) {
        console.error(err);
        return (0, response_1.errorResponse)(res, 'Internal server error', 500);
    }
};
exports.updateFirebaseToken = updateFirebaseToken;
//# sourceMappingURL=firebace.controller.js.map