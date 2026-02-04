import { PrismaClient, Role } from '@prisma/client';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { errorResponse, successResponse } from '../../utils/response';
import type { AdminRequest } from '../../middlewares/adminPermissions';
import { SubAdminPermissionType } from '../../middlewares/adminPermissions';

const prisma = new PrismaClient();

const PERMISSIONS_LIST: SubAdminPermissionType[] = [
  'MANAGE_USERS',
  'MANAGE_PLANS',
  'MANAGE_RESTAURANTS',
  'MANAGE_SUBSCRIPTIONS',
];

/**
 * @swagger
 * tags:
 *   - name: Sub-admins
 *     description: Sub-admin management (main admin only)
 */

/**
 * List all sub-admins added by the current (main) admin.
 * Main admin only.
 *
 * @swagger
 * /api/admin/subadmins:
 *   get:
 *     summary: List sub-admins
 *     description: Returns all sub-admins added by the current main admin.
 *     tags: [Sub-admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sub-admins list
 *       403:
 *         description: Only main admin can list sub-admins
 *       500:
 *         description: Internal server error
 */
export const listSubAdmins = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return errorResponse(res, 'Only main admin can list sub-admins', 403);
    }

    const subAdmins = await prisma.subAdmin.findMany({
      where: { addedByUserId: currentUser.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
        permissions: {
          select: { permission: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = subAdmins.map((sa) => ({
      id: sa.id,
      userId: sa.userId,
      addedByUserId: sa.addedByUserId,
      createdAt: sa.createdAt,
      user: sa.user,
      permissions: sa.permissions.map((p) => p.permission),
    }));

    successResponse(res, 'Sub-admins retrieved successfully', { subAdmins: data }, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * Get current user's admin permissions (for SUBADMIN: granted list; for ADMIN: all).
 * Used by frontend to build admin sidebar.
 *
 * @swagger
 * /api/admin/subadmins/my-permissions:
 *   get:
 *     summary: Get my admin permissions
 *     description: Returns permissions for current user (ADMIN gets all; SUBADMIN gets granted list).
 *     tags: [Sub-admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: { permissions: string[], role: 'ADMIN' | 'SUBADMIN' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
export const getMyPermissions = async (req: AdminRequest, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return errorResponse(res, 'Unauthorized', 401);

    if (user.role === 'ADMIN') {
      return successResponse(res, 'OK', { permissions: PERMISSIONS_LIST, role: 'ADMIN' }, 200);
    }
    if (user.role === 'SUBADMIN' && req.subAdmin?.permissions) {
      return successResponse(
        res,
        'OK',
        { permissions: req.subAdmin.permissions, role: 'SUBADMIN' },
        200,
      );
    }
    return errorResponse(res, 'Forbidden', 403);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * Create a new sub-admin: create user with role SUBADMIN and assign permissions.
 * Main admin only.
 */
export const createSubAdmin = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return errorResponse(res, 'Only main admin can add sub-admins', 403);
    }

    const { email, password, fullName, permissions } = req.body as {
      email: string;
      password: string;
      fullName?: string;
      permissions: SubAdminPermissionType[];
    };

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p) => PERMISSIONS_LIST.includes(p))
      : [];
    if (validPerms.length === 0) {
      return errorResponse(res, 'At least one permission is required', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(res, 'Email already exists', 400);
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName || null,
        role: Role.SUBADMIN,
        isActive: true,
        qrCode: uuidv4(),
      },
    });

    const subAdmin = await prisma.subAdmin.create({
      data: {
        userId: newUser.id,
        addedByUserId: currentUser.id,
      },
    });

    await prisma.subAdminPermission.createMany({
      data: validPerms.map((permission) => ({
        subAdminId: subAdmin.id,
        permission,
      })),
    });

    const created = await prisma.subAdmin.findUnique({
      where: { id: subAdmin.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
        permissions: { select: { permission: true } },
      },
    });

    const data = created
      ? {
          id: created.id,
          userId: created.userId,
          addedByUserId: created.addedByUserId,
          createdAt: created.createdAt,
          user: created.user,
          permissions: created.permissions.map((p) => p.permission),
        }
      : null;

    successResponse(res, 'Sub-admin created successfully', data, 201);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * Update a sub-admin's permissions.
 * Main admin only; can only update sub-admins they added.
 *
 * @swagger
 * /api/admin/subadmins/{id}:
 *   put:
 *     summary: Update sub-admin permissions
 *     description: Updates the permissions of a sub-admin. Main admin only; only for sub-admins they added.
 *     tags: [Sub-admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Sub-admin record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items: { type: string, enum: [MANAGE_USERS, MANAGE_PLANS, MANAGE_RESTAURANTS, MANAGE_SUBSCRIPTIONS] }
 *     responses:
 *       200:
 *         description: Sub-admin updated
 *       400:
 *         description: At least one permission required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Sub-admin not found
 *       500:
 *         description: Internal server error
 */
export const updateSubAdmin = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return errorResponse(res, 'Only main admin can update sub-admins', 403);
    }

    const id = req.params.id;
    if (!id) {
      return errorResponse(res, 'Sub-admin ID is required', 400);
    }
    const { permissions } = req.body as { permissions: SubAdminPermissionType[] };

    const subAdmin = await prisma.subAdmin.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!subAdmin) {
      return errorResponse(res, 'Sub-admin not found', 404);
    }
    if (subAdmin.addedByUserId !== currentUser.id) {
      return errorResponse(res, 'You can only update sub-admins you added', 403);
    }

    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p) => PERMISSIONS_LIST.includes(p))
      : [];
    if (validPerms.length === 0) {
      return errorResponse(res, 'At least one permission is required', 400);
    }

    const subAdminId = subAdmin.id;
    await prisma.subAdminPermission.deleteMany({ where: { subAdminId } });
    await prisma.subAdminPermission.createMany({
      data: validPerms.map((permission) => ({ subAdminId, permission })),
    });

    const updated = await prisma.subAdmin.findUnique({
      where: { id: subAdminId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
        permissions: { select: { permission: true } },
      },
    });

    const data = updated
      ? {
          id: updated.id,
          userId: updated.userId,
          addedByUserId: updated.addedByUserId,
          createdAt: updated.createdAt,
          user: updated.user,
          permissions: updated.permissions.map((p) => p.permission),
        }
      : null;

    successResponse(res, 'Sub-admin updated successfully', data, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * Remove sub-admin: delete SubAdmin record (cascade permissions) and set user role to USER.
 * Main admin only; can only remove sub-admins they added.
 *
 * @swagger
 * /api/admin/subadmins/{id}:
 *   delete:
 *     summary: Remove sub-admin
 *     description: Removes sub-admin record and sets their user role to USER. Main admin only.
 *     tags: [Sub-admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Sub-admin record ID
 *     responses:
 *       200:
 *         description: Sub-admin removed
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Sub-admin not found
 *       500:
 *         description: Internal server error
 */
export const deleteSubAdmin = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return errorResponse(res, 'Only main admin can remove sub-admins', 403);
    }

    const id = req.params.id;
    if (!id) {
      return errorResponse(res, 'Sub-admin ID is required', 400);
    }

    const subAdmin = await prisma.subAdmin.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!subAdmin) {
      return errorResponse(res, 'Sub-admin not found', 404);
    }
    if (subAdmin.addedByUserId !== currentUser.id) {
      return errorResponse(res, 'You can only remove sub-admins you added', 403);
    }

    const subAdminId = subAdmin.id;
    await prisma.$transaction([
      prisma.subAdminPermission.deleteMany({ where: { subAdminId } }),
      prisma.subAdmin.delete({ where: { id: subAdminId } }),
      prisma.user.update({
        where: { id: subAdmin.userId },
        data: { role: 'USER' },
      }),
    ]);

    successResponse(res, 'Sub-admin removed successfully', null, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};
