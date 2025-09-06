"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLogin = void 0;
const hash_1 = require("../../utils/hash");
const token_1 = require("../../utils/token");
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const prisma = new client_1.PrismaClient();
/**
 * @swagger
 * api/auth/admin/login:
 *   post:
 *     summary: Login admin user
 *     description: Login for ADMIN and SUB_ADMIN only. Regular users cannot use this route.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: AdminPassword123
 *     responses:
 *       200:
 *         description: Login successful, returns admin info and tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     role:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Incorrect password
 *       403:
 *         description: Only admins are allowed
 *       404:
 *         description: Email address not found
 *       500:
 *         description: Server error
 */
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return (0, response_1.errorResponse)(res, 'Email and password required', 400);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return (0, response_1.errorResponse)(res, 'Email not found', 404);
        if (!['ADMIN', 'SUB_ADMIN'].includes(user.role)) {
            return (0, response_1.errorResponse)(res, 'Only admins are allowed', 403);
        }
        const isPasswordValid = await (0, hash_1.comparePassword)(password, user.password);
        if (!isPasswordValid)
            return (0, response_1.errorResponse)(res, 'Incorrect password', 401);
        const accessToken = (0, token_1.generateAccessToken)({ userId: user.id, role: user.role });
        const refreshToken = (0, token_1.generateRefreshToken)({ userId: user.id, role: user.role });
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
        return (0, response_1.successResponse)(res, 'Admin login successful', {
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
            tokens: { accessToken, refreshToken },
        });
    }
    catch {
        return (0, response_1.errorResponse)(res, 'Unexpected error', 500);
    }
};
exports.adminLogin = adminLogin;
//# sourceMappingURL=admin.auth.controller.js.map