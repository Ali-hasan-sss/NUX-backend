import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { comparePassword, hashPassword } from '../../utils/hash';
import { sendEmailVerificationCode, sendVerificationEmail } from '../../utils/email';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        qrCode: true,
      },
    });
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, 'Profile retrieved successfully', user, 200);
  } catch {
    return errorResponse(res, 'Server error', 500);
  }
};

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

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { fullName, email } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) return errorResponse(res, 'User not found', 404);

    let updateData: any = {};

    if (fullName) updateData.fullName = fullName;

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return errorResponse(res, 'Email is already taken', 409);
      }

      const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!strictEmailRegex.test(email)) {
        return errorResponse(res, 'Invalid email format', 400);
      }

      // generate verify code
      const verificationCode = uuidv4();
      const expiry = new Date(Date.now() + 1000 * 60 * 15);

      updateData.email = email;
      updateData.emailVerified = null;
      updateData.emailVerificationCode = verificationCode;
      updateData.emailVerificationExpiry = expiry;

      if (process.env.NODE_ENV === 'test') {
        await sendEmailVerificationCode(email, verificationCode).catch(console.error);
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
        qrCode: true,
      },
    });

    return successResponse(
      res,
      email && email !== user.email
        ? 'Profile updated successfully. Please verify your new email.'
        : 'Profile updated successfully',
      updatedUser,
      200,
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

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
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) return errorResponse(res, 'User not found', 404);

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) return errorResponse(res, 'Current password is incorrect', 401);

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return successResponse(res, 'Password changed successfully', null, 200);
  } catch {
    return errorResponse(res, 'Server error', 500);
  }
};

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
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) return errorResponse(res, 'User not found', 404);

    const isValid = await comparePassword(password, user.password);
    if (!isValid) return errorResponse(res, 'Password is incorrect', 401);

    await prisma.user.delete({ where: { id: user.id } });

    return successResponse(res, 'Account deleted successfully', null, 200);
  } catch {
    return errorResponse(res, 'Server error', 500);
  }
};
