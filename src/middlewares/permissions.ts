import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse } from '../utils/response';

enum PermissionType {
  // Restaurant Management
  MANAGE_MENU = 'MANAGE_MENU',
  MANAGE_QR_CODES = 'MANAGE_QR_CODES',
  MANAGE_GROUPS = 'MANAGE_GROUPS',
  MANAGE_ADS = 'MANAGE_ADS',
  MANAGE_PACKAGES = 'MANAGE_PACKAGES',
  MANAGE_ORDERS = 'MANAGE_ORDERS',
}

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: any;
  restaurant?: {
    id: string;
    isSubscriptionActive: boolean;
  };
}

/**
 * Middleware to check if restaurant has specific permission
 * @param permission - The permission type to check
 * @param checkLimit - Whether to check numeric limits (for MAX_* permissions)
 * @param getCurrentCount - Function to get current count for limit checking
 */
export const checkPermission = (
  permission: PermissionType,
  checkLimit: boolean = false,
  getCurrentCount?: (restaurantId: string) => Promise<number>,
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.restaurant?.id) {
        return errorResponse(res, 'Restaurant not found', 404);
      }

      if (!req.restaurant.isSubscriptionActive) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found. Subscribe to a plan to use this feature.',
          code: 'NO_ACTIVE_SUBSCRIPTION',
        });
      }

      // Get restaurant's active subscription with plan and permissions (most recent first)
      const activeSubscription = (await prisma.subscription.findFirst({
        where: {
          restaurantId: req.restaurant.id,
          status: 'ACTIVE',
          endDate: {
            gte: new Date(),
          },
        },
        orderBy: { endDate: 'desc' },
        include: {
          plan: {
            include: {
              permissions: true,
            },
          },
        },
      })) as any;

      if (!activeSubscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found. Subscribe to a plan to use this feature.',
          code: 'NO_ACTIVE_SUBSCRIPTION',
        });
      }

      // Find the specific permission (compare as string in case Prisma returns enum differently)
      const permissionStr = String(permission);
      const permissionData = activeSubscription.plan.permissions.find(
        (p: any) => String(p.type) === permissionStr,
      );

      if (!permissionData) {
        const planTitle = activeSubscription.plan?.title ?? `Plan #${activeSubscription.planId}`;
        return res.status(403).json({
          success: false,
          message: `Your current plan (${planTitle}) does not include this feature. Upgrade your plan to use it.`,
          code: 'PLAN_PERMISSION_REQUIRED',
          permission,
          currentPlanId: activeSubscription.planId,
          currentPlanTitle: activeSubscription.plan?.title ?? null,
        });
      }

      // Check limits if required
      if (checkLimit && getCurrentCount && !permissionData.isUnlimited) {
        const currentCount = await getCurrentCount(req.restaurant.id);
        if (currentCount >= (permissionData.value || 0)) {
          return res.status(403).json({
            success: false,
            message: `Plan limit exceeded for this feature. Upgrade your plan for more.`,
            code: 'PLAN_LIMIT_EXCEEDED',
            permission,
          });
        }
      }

      // Add permission data to request for use in controllers
      req.permission = permissionData;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return errorResponse(res, 'Permission check failed', 500);
    }
  };
};

/**
 * Middleware to check if restaurant can manage menu
 */
export const canManageMenu = checkPermission(
  PermissionType.MANAGE_MENU,
  true,
  async (restaurantId: string) => {
    return await prisma.menuItem.count({
      where: {
        category: {
          restaurantId: restaurantId,
        },
      },
    });
  },
);

/**
 * Middleware to check if restaurant can manage QR codes
 */
export const canManageQRCodes = checkPermission(
  PermissionType.MANAGE_QR_CODES,
  true,
  async (restaurantId: string) => {
    // QR codes are generated per restaurant, so we count them as 1
    // This is more of a feature check than a limit check
    return 1;
  },
);

/**
 * Middleware to check if restaurant can manage groups
 */
export const canManageGroups = checkPermission(
  PermissionType.MANAGE_GROUPS,
  true,
  async (restaurantId: string) => {
    // Check if restaurant is already a member of a group
    const membership = await prisma.groupMembership.findFirst({
      where: { restaurantId },
    });
    return membership ? 1 : 0;
  },
);

/**
 * Middleware to check if restaurant can manage ads
 */
export const canManageAds = checkPermission(
  PermissionType.MANAGE_ADS,
  true,
  async (restaurantId: string) => {
    return await prisma.ad.count({ where: { restaurantId } });
  },
);

/**
 * Middleware to check if restaurant can manage packages
 */
export const canManagePackages = checkPermission(
  PermissionType.MANAGE_PACKAGES,
  true,
  async (restaurantId: string) => {
    return await prisma.topUpPackage.count({ where: { restaurantId } });
  },
);

/**
 * Middleware to check if restaurant can manage orders (send/receive orders from dashboard)
 */
export const canManageOrders = checkPermission(PermissionType.MANAGE_ORDERS, false, undefined);

// Note: Other permission middlewares removed as they are not needed for current restaurant management features

// Extend Request interface to include permission
declare global {
  namespace Express {
    interface Request {
      permission?: {
        id: number;
        type: PermissionType;
        value: number | null;
        isUnlimited: boolean;
      };
    }
  }
}
