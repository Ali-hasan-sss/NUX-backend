// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { comparePassword } from '../../utils/hash';
import { generateAccessToken, generateRefreshToken } from '../../utils/token';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();

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
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return errorResponse(res, 'Email and password required', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return errorResponse(res, 'Email not found', 404);

    if (!['ADMIN', 'SUB_ADMIN'].includes(user.role)) {
      return errorResponse(res, 'Only admins are allowed', 403);
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) return errorResponse(res, 'Incorrect password', 401);

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    return successResponse(res, 'Admin login successful', {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      tokens: { accessToken, refreshToken },
    });
  } catch {
    return errorResponse(res, 'Unexpected error', 500);
  }
};
