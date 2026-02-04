/**
 * Admin panel permissions for SUBADMIN role.
 * Only ADMIN can add/remove sub-admins; SUBADMIN has access only to granted permissions.
 */
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse } from '../utils/response';

export type SubAdminPermissionType =
  | 'MANAGE_USERS'
  | 'MANAGE_PLANS'
  | 'MANAGE_RESTAURANTS'
  | 'MANAGE_SUBSCRIPTIONS';

const prisma = new PrismaClient();

export interface AdminRequest extends Request {
  subAdmin?: {
    id: string;
    userId: string;
    addedByUserId: string;
    permissions: SubAdminPermissionType[];
  };
}

/**
 * Allow only ADMIN or SUBADMIN; for SUBADMIN load permissions and attach to req.
 */
export const isAdminOrSubAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  if (!user) {
    return errorResponse(res, 'Unauthorized', 401);
  }
  if (user.role === 'ADMIN') {
    return next();
  }
  if (user.role === 'SUBADMIN') {
    const subAdmin = await prisma.subAdmin.findUnique({
      where: { userId: user.id },
      include: { permissions: true },
    });
    if (!subAdmin) {
      return errorResponse(res, 'Sub-admin record not found', 403);
    }
    req.subAdmin = {
      id: subAdmin.id,
      userId: subAdmin.userId,
      addedByUserId: subAdmin.addedByUserId,
      permissions: subAdmin.permissions.map((p) => p.permission as SubAdminPermissionType),
    };
    return next();
  }
  return errorResponse(res, 'Forbidden', 403);
};

/**
 * Require main ADMIN only (used for sub-admin CRUD). SUBADMIN cannot add/remove sub-admins.
 */
export const requireMainAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) return errorResponse(res, 'Unauthorized', 401);
  if (user.role !== 'ADMIN') {
    return errorResponse(res, 'Only main admin can manage sub-admins', 403);
  }
  next();
};

/**
 * Require either ADMIN or SUBADMIN with the given permission.
 */
export const requirePermission = (permission: SubAdminPermissionType) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return errorResponse(res, 'Unauthorized', 401);
    if (user.role === 'ADMIN') return next();
    if (user.role === 'SUBADMIN' && req.subAdmin?.permissions?.includes(permission)) {
      return next();
    }
    return errorResponse(res, 'You do not have permission for this action', 403);
  };
};
