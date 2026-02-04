import { PrismaClient } from '@prisma/client';

enum PermissionType {
  // Restaurant Management
  MANAGE_MENU = 'MANAGE_MENU',
  MANAGE_QR_CODES = 'MANAGE_QR_CODES',
  MANAGE_GROUPS = 'MANAGE_GROUPS',
  MANAGE_ADS = 'MANAGE_ADS',
  MANAGE_PACKAGES = 'MANAGE_PACKAGES',
  MANAGE_ORDERS = 'MANAGE_ORDERS',

  // Customer Features
  CUSTOMER_LOYALTY = 'CUSTOMER_LOYALTY',
  CUSTOMER_NOTIFICATIONS = 'CUSTOMER_NOTIFICATIONS',
  CUSTOMER_GIFTS = 'CUSTOMER_GIFTS',

  // Analytics & Reports
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  EXPORT_DATA = 'EXPORT_DATA',

  // Advanced Features
  CUSTOM_BRANDING = 'CUSTOM_BRANDING',
  API_ACCESS = 'API_ACCESS',
  MULTI_LOCATION = 'MULTI_LOCATION',

  // Limits
  MAX_MENU_ITEMS = 'MAX_MENU_ITEMS',
  MAX_ADS = 'MAX_ADS',
  MAX_PACKAGES = 'MAX_PACKAGES',
  MAX_GROUP_MEMBERS = 'MAX_GROUP_MEMBERS',
}

const prisma = new PrismaClient();

export interface RestaurantPermission {
  type: PermissionType;
  value: number | null;
  isUnlimited: boolean;
}

/**
 * Get all permissions for a restaurant's active subscription
 */
export const getRestaurantPermissions = async (
  restaurantId: string,
): Promise<RestaurantPermission[]> => {
  const activeSubscription = (await prisma.subscription.findFirst({
    where: {
      restaurantId,
      status: 'ACTIVE',
      endDate: {
        gte: new Date(),
      },
    },
    include: {
      plan: {
        include: {
          permissions: true,
        },
      },
    },
  })) as any;

  if (!activeSubscription) {
    return [];
  }

  return activeSubscription.plan.permissions.map((p: any) => ({
    type: p.type,
    value: p.value,
    isUnlimited: p.isUnlimited,
  }));
};

/**
 * Check if restaurant has a specific permission
 */
export const hasPermission = async (
  restaurantId: string,
  permission: PermissionType,
): Promise<boolean> => {
  const permissions = await getRestaurantPermissions(restaurantId);
  return permissions.some((p) => p.type === permission);
};

/**
 * Get permission value for limit checking
 */
export const getPermissionValue = async (
  restaurantId: string,
  permission: PermissionType,
): Promise<number | null> => {
  const permissions = await getRestaurantPermissions(restaurantId);
  const perm = permissions.find((p) => p.type === permission);
  return perm?.isUnlimited ? null : perm?.value || null;
};

/**
 * Check if restaurant can perform an action within limits
 */
export const canPerformAction = async (
  restaurantId: string,
  permission: PermissionType,
  currentCount: number,
): Promise<boolean> => {
  const permissions = await getRestaurantPermissions(restaurantId);
  const perm = permissions.find((p) => p.type === permission);

  if (!perm) return false;
  if (perm.isUnlimited) return true;

  return currentCount < (perm.value || 0);
};
