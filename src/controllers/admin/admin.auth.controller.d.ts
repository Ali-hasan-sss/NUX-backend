import { Request, Response } from 'express';
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
export declare const adminLogin: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=admin.auth.controller.d.ts.map