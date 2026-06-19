import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse } from '../utils/response';
import { getEffectiveActiveSubscription } from '../utils/subscription';

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

async function loadActiveSubscription(restaurantId: string) {
  return (await getEffectiveActiveSubscription(restaurantId)) as any;
}

function findPermission(activeSubscription: any, permission: PermissionType) {
  const permissionStr = String(permission);
  return activeSubscription?.plan?.permissions?.find(
    (p: any) => String(p.type) === permissionStr,
  );
}

/**
 * Middleware to check if restaurant has specific permission
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

      const activeSubscription = await loadActiveSubscription(req.restaurant.id);

      if (!activeSubscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found. Subscribe to a plan to use this feature.',
          code: 'NO_ACTIVE_SUBSCRIPTION',
        });
      }

      const permissionData = findPermission(activeSubscription, permission);

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

      req.permission = permissionData;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return errorResponse(res, 'Permission check failed', 500);
    }
  };
};

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

/** Feature flag — not a numeric limit. */
export const canManageQRCodes = checkPermission(PermissionType.MANAGE_QR_CODES, false, undefined);

export const canManageGroups = checkPermission(
  PermissionType.MANAGE_GROUPS,
  true,
  async (restaurantId: string) => {
    const membership = await prisma.groupMembership.findFirst({
      where: { restaurantId },
    });
    return membership ? 1 : 0;
  },
);

export const canManageAds = checkPermission(
  PermissionType.MANAGE_ADS,
  true,
  async (restaurantId: string) => {
    return await prisma.ad.count({ where: { restaurantId } });
  },
);

export const canManagePackages = checkPermission(
  PermissionType.MANAGE_PACKAGES,
  true,
  async (restaurantId: string) => {
    return await prisma.topUpPackage.count({ where: { restaurantId } });
  },
);

export const canManageOrders = checkPermission(PermissionType.MANAGE_ORDERS, false, undefined);

/** Tables list: orders dashboard or QR/table management. */
export const canManageOrdersOrQRCodes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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

    const activeSubscription = await loadActiveSubscription(req.restaurant.id);

    if (!activeSubscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription found. Subscribe to a plan to use this feature.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    const hasOrders = !!findPermission(activeSubscription, PermissionType.MANAGE_ORDERS);
    const hasQr = !!findPermission(activeSubscription, PermissionType.MANAGE_QR_CODES);

    if (!hasOrders && !hasQr) {
      const planTitle = activeSubscription.plan?.title ?? `Plan #${activeSubscription.planId}`;
      return res.status(403).json({
        success: false,
        message: `Your current plan (${planTitle}) does not include this feature. Upgrade your plan to use it.`,
        code: 'PLAN_PERMISSION_REQUIRED',
        currentPlanId: activeSubscription.planId,
        currentPlanTitle: activeSubscription.plan?.title ?? null,
      });
    }

    next();
  } catch (error) {
    console.error('Permission check error:', error);
    return errorResponse(res, 'Permission check failed', 500);
  }
};

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
