import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

enum PermissionType {
  // Restaurant Management
  MANAGE_MENU = 'MANAGE_MENU',
  MANAGE_QR_CODES = 'MANAGE_QR_CODES',
  MANAGE_GROUPS = 'MANAGE_GROUPS',
  MANAGE_ADS = 'MANAGE_ADS',
  MANAGE_PACKAGES = 'MANAGE_PACKAGES',

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

/**
 * Create Stripe product and price for a plan
 */
const createStripeProductAndPrice = async (
  title: string,
  description: string | null,
  price: number,
  currency: string,
  duration: number,
) => {
  try {
    // Don't create Stripe product for free plans
    if (price <= 0) {
      return {
        productId: null,
        priceId: null,
      };
    }

    // Create Stripe product
    const product = await stripe.products.create({
      name: title,
      ...(description && { description }),
      metadata: {
        duration: duration.toString(),
        type: 'subscription_plan',
      },
    });

    // Create Stripe price (recurring monthly)
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100), // Convert to cents
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
        interval_count: Math.ceil(duration / 30), // Convert days to months
      },
      metadata: {
        plan_duration_days: duration.toString(),
      },
    });

    return {
      productId: product.id,
      priceId: stripePrice.id,
    };
  } catch (error) {
    console.error('Error creating Stripe product/price:', error);
    throw new Error('Failed to create Stripe product and price');
  }
};

/**
 * Update Stripe product and create new price if needed
 */
const updateStripeProductAndPrice = async (
  productId: string,
  title: string,
  description: string | null,
  price: number,
  currency: string,
  duration: number,
) => {
  try {
    // Don't update Stripe for free plans
    if (price <= 0) {
      return {
        productId: null,
        priceId: null,
      };
    }

    // Update existing Stripe product
    await stripe.products.update(productId, {
      name: title,
      ...(description && { description }),
      metadata: {
        duration: duration.toString(),
        type: 'subscription_plan',
      },
    });

    // Create new price (Stripe prices are immutable, so we create a new one)
    const stripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(price * 100), // Convert to cents
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
        interval_count: Math.ceil(duration / 30), // Convert days to months
      },
      metadata: {
        plan_duration_days: duration.toString(),
      },
    });

    return {
      productId,
      priceId: stripePrice.id,
    };
  } catch (error) {
    console.error('Error updating Stripe product/price:', error);
    throw new Error('Failed to update Stripe product and price');
  }
};

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: Admin management of subscription plans
 */

/**
 * @swagger
 * /api/admin/plans:
 *   get:
 *     summary: Get all plans
 *     tags: [Plans]
 *     responses:
 *       200:
 *         description: List of all plans
 *       500:
 *         description: Internal server error
 */
export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plans = (await prisma.plan.findMany({
      include: {
        permissions: true,
      },
    })) as any;
    return successResponse(res, 'Plans retrieved successfully', plans);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/plans/{id}:
 *   get:
 *     summary: Get a plan by ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Internal server error
 */
export const getPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = (await prisma.plan.findUnique({
      where: { id: Number(id) },
      include: {
        permissions: true,
      },
    })) as any;

    if (!plan) return errorResponse(res, 'Plan not found', 404);
    return successResponse(res, 'Plan retrieved successfully', plan);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/plans:
 *   post:
 *     summary: Create a new plan
 *     tags: [Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - price
 *               - currency
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *               duration:
 *                 type: integer
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [MANAGE_MENU, MANAGE_QR_CODES, MANAGE_GROUPS, MANAGE_ADS, MANAGE_PACKAGES, CUSTOMER_LOYALTY, CUSTOMER_NOTIFICATIONS, CUSTOMER_GIFTS, VIEW_ANALYTICS, EXPORT_DATA, CUSTOM_BRANDING, API_ACCESS, MULTI_LOCATION, MAX_MENU_ITEMS, MAX_ADS, MAX_PACKAGES, MAX_GROUP_MEMBERS]
 *                     value:
 *                       type: integer
 *                     isUnlimited:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       500:
 *         description: Internal server error
 */
export const createPlan = async (req: Request, res: Response) => {
  try {
    const { title, description, currency, price, duration, permissions = [] } = req.body;
    const finalPrice = Number(price);

    let stripeData: { productId: string | null; priceId: string | null } = {
      productId: null,
      priceId: null,
    };

    // Only create Stripe product and price if the plan is not free (price > 0)
    if (finalPrice > 0) {
      stripeData = await createStripeProductAndPrice(
        title,
        description,
        finalPrice,
        currency,
        Number(duration),
      );
    }

    const plan = (await prisma.plan.create({
      data: {
        title,
        description,
        price: finalPrice,
        currency,
        duration: Number(duration),
        stripeProductId: stripeData.productId,
        stripePriceId: stripeData.priceId,
        permissions: {
          create: permissions.map((permission: any) => ({
            type: permission.type as PermissionType,
            value: permission.value,
            isUnlimited: permission.isUnlimited || false,
          })),
        },
      },
      include: {
        permissions: true,
      },
    })) as any;

    return successResponse(res, 'Plan created successfully', plan, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      error instanceof Error ? error.message : 'Internal server error',
      500,
    );
  }
};

/**
 * @swagger
 * /api/admin/plans/{id}:
 *   put:
 *     summary: Update a plan by ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *               duration:
 *                 type: integer
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [MANAGE_MENU, MANAGE_QR_CODES, MANAGE_GROUPS, MANAGE_ADS, MANAGE_PACKAGES, CUSTOMER_LOYALTY, CUSTOMER_NOTIFICATIONS, CUSTOMER_GIFTS, VIEW_ANALYTICS, EXPORT_DATA, CUSTOM_BRANDING, API_ACCESS, MULTI_LOCATION, MAX_MENU_ITEMS, MAX_ADS, MAX_PACKAGES, MAX_GROUP_MEMBERS]
 *                     value:
 *                       type: integer
 *                     isUnlimited:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Internal server error
 */
export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, currency, price, duration, isActive, permissions } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } });
    if (!plan) return errorResponse(res, 'Plan not found', 404);

    const finalTitle = title ?? plan.title;
    const finalDescription = description ?? plan.description;
    const finalPrice = price !== undefined ? Number(price) : plan.price;
    const finalCurrency = currency ?? plan.currency;
    const finalDuration = duration !== undefined ? Number(duration) : plan.duration;

    // Check if price, currency, or duration changed (need to update Stripe)
    const priceChanged = price !== undefined && Number(price) !== plan.price;
    const currencyChanged = currency !== undefined && currency !== plan.currency;
    const durationChanged = duration !== undefined && Number(duration) !== plan.duration;
    const needsStripeUpdate =
      priceChanged || currencyChanged || durationChanged || title !== undefined;

    let stripeData = null;

    // Only update Stripe if the plan is not free (price > 0)
    if (needsStripeUpdate && finalPrice > 0) {
      if (plan.stripeProductId) {
        // Update existing Stripe product and create new price
        stripeData = await updateStripeProductAndPrice(
          plan.stripeProductId,
          finalTitle,
          finalDescription,
          finalPrice,
          finalCurrency,
          finalDuration,
        );
      } else {
        // Create new Stripe product and price if none exists
        stripeData = await createStripeProductAndPrice(
          finalTitle,
          finalDescription,
          finalPrice,
          finalCurrency,
          finalDuration,
        );
      }
    } else if (needsStripeUpdate && finalPrice === 0) {
      // For free plans, clear Stripe data if it exists
      stripeData = {
        productId: null,
        priceId: null,
      };
    }

    const updateData: any = {
      title: finalTitle,
      description: finalDescription,
      price: finalPrice,
      currency: finalCurrency,
      isActive: isActive !== undefined ? Boolean(isActive) : plan.isActive,
      duration: finalDuration,
    };

    // Add Stripe IDs if updated
    if (stripeData) {
      updateData.stripeProductId = stripeData.productId;
      updateData.stripePriceId = stripeData.priceId;
    }

    // Handle permissions update if provided
    if (permissions !== undefined) {
      updateData.permissions = {
        deleteMany: {}, // Remove all existing permissions
        create: permissions.map((permission: any) => ({
          type: permission.type as PermissionType,
          value: permission.value,
          isUnlimited: permission.isUnlimited || false,
        })),
      };
    }

    const updated = (await prisma.plan.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        permissions: true,
      },
    })) as any;

    return successResponse(res, 'Plan updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      error instanceof Error ? error.message : 'Internal server error',
      500,
    );
  }
};

/**
 * @swagger
 * /api/admin/plans/{id}:
 *   delete:
 *     summary: Delete a plan by ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The plan ID
 *     responses:
 *       200:
 *         description: Plan deleted successfully
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Internal server error
 */
export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } });
    if (!plan) return errorResponse(res, 'Plan not found', 404);

    await prisma.plan.delete({ where: { id: Number(id) } });
    return successResponse(res, 'Plan deleted successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
  }
};
