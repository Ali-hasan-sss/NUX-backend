"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.changePassword = exports.updateProfile = exports.getProfile = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../../utils/response");
const hash_1 = require("../../utils/hash");
const email_1 = require("../../utils/email");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
/**
 * @swagger
 * tags:
 *   - name: Account
 *     description: Endpoints for managing client account (profile, password, deletion)
 */
/**
 * @swagger
 * /client/account/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        if (!user)
            return (0, response_1.errorResponse)(res, 'User not found', 404);
        return (0, response_1.successResponse)(res, 'Profile retrieved successfully', user, 200);
    }
    catch {
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.getProfile = getProfile;
/**
 * @swagger
 * /client/account/me:
 *   put:
 *     summary: Update profile (full name or email)
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error (e.g. invalid email format)
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email is already taken
 */
const updateProfile = async (req, res) => {
    try {
        const { fullName, email } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user)
            return (0, response_1.errorResponse)(res, 'User not found', 404);
        let updateData = {};
        if (fullName)
            updateData.fullName = fullName;
        if (email && email !== user.email) {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return (0, response_1.errorResponse)(res, 'Email is already taken', 409);
            }
            const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!strictEmailRegex.test(email)) {
                return (0, response_1.errorResponse)(res, 'Invalid email format', 400);
            }
            // generate verify code
            const verificationCode = (0, uuid_1.v4)();
            const expiry = new Date(Date.now() + 1000 * 60 * 15);
            updateData.email = email;
            updateData.emailVerified = null;
            updateData.emailVerificationCode = verificationCode;
            updateData.emailVerificationExpiry = expiry;
            if (process.env.NODE_ENV === 'test') {
                await (0, email_1.sendEmailVerificationCode)(email, verificationCode).catch(console.error);
            }
        }
        // ✅ إضافة هذا الشرط لتجنب أي تحقق إذا لم يتغير البريد
        else {
            updateData.email = user.email;
        }
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                emailVerified: true,
            },
        });
        return (0, response_1.successResponse)(res, email && email !== user.email
            ? 'Profile updated successfully. Please verify your new email.'
            : 'Profile updated successfully', updatedUser, 200);
    }
    catch (error) {
        console.error('Update profile error:', error);
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.updateProfile = updateProfile;
/**
 * @swagger
 * /client/account/me/change-password:
 *   put:
 *     summary: Change current user's password
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 example: newPassword456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized / Invalid password
 *       404:
 *         description: User not found
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user)
            return (0, response_1.errorResponse)(res, 'User not found', 404);
        const isValid = await (0, hash_1.comparePassword)(currentPassword, user.password);
        if (!isValid)
            return (0, response_1.errorResponse)(res, 'Current password is incorrect', 401);
        const hashedPassword = await (0, hash_1.hashPassword)(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });
        return (0, response_1.successResponse)(res, 'Password changed successfully', null, 200);
    }
    catch {
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.changePassword = changePassword;
/**
 * @swagger
 * /client/account/me:
 *   delete:
 *     summary: Delete current user's account
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: mySecret123
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized / Invalid password
 *       404:
 *         description: User not found
 */
const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user)
            return (0, response_1.errorResponse)(res, 'User not found', 404);
        const isValid = await (0, hash_1.comparePassword)(password, user.password);
        if (!isValid)
            return (0, response_1.errorResponse)(res, 'Password is incorrect', 401);
        await prisma.user.delete({ where: { id: user.id } });
        return (0, response_1.successResponse)(res, 'Account deleted successfully', null, 200);
    }
    catch {
        return (0, response_1.errorResponse)(res, 'Server error', 500);
    }
};
exports.deleteAccount = deleteAccount;
//# sourceMappingURL=account.controller.js.map