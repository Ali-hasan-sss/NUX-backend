import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { stripeStatementDescriptor } from '../../utils/stripeSubscriptionSync';

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
const FREE_TRIAL_PLAN_TITLE = 'Free Trial';

function isFreeTrialPlanTitle(title: string | null | undefined): boolean {
  return title?.trim().toLowerCase() === FREE_TRIAL_PLAN_TITLE.toLowerCase();
}

type StripePlanData = {
  productId: string | null;
  priceId: string | null;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
};

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const stripeError = error as { code?: string; message?: string; statusCode?: number };
  return (
    stripeError.code === 'resource_missing' ||
    stripeError.statusCode === 404 ||
    stripeError.message?.toLowerCase().includes('no such') === true
  );
}

/**
 * Create Stripe product and price for a plan
 */
const createStripeProductAndPrice = async (
  title: string,
  description: string | null,
  price: number,
  currency: string,
  duration: number,
  monthlyPrice = price,
  annualPrice = price * 12,
) => {
  try {
    // Don't create Stripe product for free plans
    if (price <= 0) {
      return {
        productId: null,
        priceId: null,
        monthlyPriceId: null,
        annualPriceId: null,
      };
    }

    // Create Stripe product
    const product = await stripe.products.create({
      name: title,
      statement_descriptor: stripeStatementDescriptor(),
      ...(description && { description }),
      metadata: {
        duration: duration.toString(),
        type: 'subscription_plan',
      },
    });

    const monthlyStripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(monthlyPrice * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      metadata: {
        plan_duration_days: duration.toString(),
        billing_cycle: 'monthly',
      },
    });

    const annualStripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(annualPrice * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      metadata: {
        plan_duration_days: '365',
        billing_cycle: 'annual',
      },
    });

    return {
      productId: product.id,
      priceId: monthlyStripePrice.id,
      monthlyPriceId: monthlyStripePrice.id,
      annualPriceId: annualStripePrice.id,
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
  productId: string | null,
  title: string,
  description: string | null,
  price: number,
  currency: string,
  duration: number,
  monthlyPrice = price,
  annualPrice = price * 12,
) => {
  try {
    // Don't update Stripe for free plans
    if (price <= 0) {
      return {
        productId: null,
        priceId: null,
        monthlyPriceId: null,
        annualPriceId: null,
      };
    }

    if (!productId) {
      return createStripeProductAndPrice(
        title,
        description,
        price,
        currency,
        duration,
        monthlyPrice,
        annualPrice,
      );
    }

    // Update existing Stripe product
    try {
      await stripe.products.update(productId, {
        name: title,
        ...(description && { description }),
        metadata: {
          duration: duration.toString(),
          type: 'subscription_plan',
        },
      });
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;

      // Existing plans may contain test-mode Stripe IDs. When running with live keys,
      // recreate the product/price and replace those stale IDs instead of blocking edits.
      return createStripeProductAndPrice(
        title,
        description,
        price,
        currency,
        duration,
        monthlyPrice,
        annualPrice,
      );
    }

    const monthlyStripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(monthlyPrice * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      metadata: {
        plan_duration_days: duration.toString(),
        billing_cycle: 'monthly',
      },
    });

    const annualStripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(annualPrice * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      metadata: {
        plan_duration_days: '365',
        billing_cycle: 'annual',
      },
    });

    return {
      productId,
      priceId: monthlyStripePrice.id,
      monthlyPriceId: monthlyStripePrice.id,
      annualPriceId: annualStripePrice.id,
    };
  } catch (error) {
    console.error('Error updating Stripe product/price:', error);
    throw new Error('Failed to update Stripe product and price');
  }
};

async function archiveStripeProduct(productId: string | null): Promise<void> {
  if (!productId) return;

  try {
    await stripe.products.update(productId, { active: false });
  } catch (error) {
    if (isMissingStripeResource(error)) return;
    throw error;
  }
}

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
      where: {
        isActive: true,
      },
      include: {
        permissions: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }, { id: 'asc' }],
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
    const {
      title,
      description,
      currency,
      price,
      monthlyPrice,
      annualPrice,
      displayOrder,
      permissions = [],
    } = req.body;
    const finalMonthlyPrice = Number(monthlyPrice ?? price);
    const finalAnnualPrice = Number(annualPrice ?? finalMonthlyPrice * 12);
    const finalPrice = finalMonthlyPrice;
    const finalDuration = 30;

    if (finalPrice <= 0 || isFreeTrialPlanTitle(title)) {
      return errorResponse(
        res,
        'Free trial plan is system-managed and is created only by seed',
        400,
      );
    }

    const finalDisplayOrder =
      displayOrder !== undefined
        ? Number(displayOrder)
        : ((await prisma.plan.aggregate({ _max: { displayOrder: true } }))._max.displayOrder ??
            0) + 1;

    let stripeData: StripePlanData = {
      productId: null,
      priceId: null,
      monthlyPriceId: null,
      annualPriceId: null,
    };

    // Only create Stripe product and price if the plan is not free (price > 0)
    if (finalPrice > 0) {
      stripeData = await createStripeProductAndPrice(
        title,
        description,
        finalPrice,
        currency,
        finalDuration,
        finalMonthlyPrice,
        finalAnnualPrice,
      );
    }

    const plan = (await prisma.plan.create({
      data: {
        title,
        description,
        price: finalPrice,
        monthlyPrice: finalMonthlyPrice,
        annualPrice: finalAnnualPrice,
        currency,
        duration: finalDuration,
        displayOrder: finalDisplayOrder,
        stripeProductId: stripeData.productId,
        stripePriceId: stripeData.priceId,
        stripeMonthlyPriceId: stripeData.monthlyPriceId,
        stripeAnnualPriceId: stripeData.annualPriceId,
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
    const {
      title,
      description,
      currency,
      price,
      monthlyPrice,
      annualPrice,
      displayOrder,
      isActive,
      permissions,
    } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } });
    if (!plan) return errorResponse(res, 'Plan not found', 404);

    const isFreeTrialPlan = isFreeTrialPlanTitle(plan.title);
    const finalTitle = isFreeTrialPlan ? FREE_TRIAL_PLAN_TITLE : (title ?? plan.title);
    const finalDescription = description ?? plan.description;
    const finalMonthlyPrice =
      isFreeTrialPlan
        ? 0
        : monthlyPrice !== undefined
        ? Number(monthlyPrice)
        : price !== undefined
          ? Number(price)
          : (plan.monthlyPrice ?? plan.price);
    const finalAnnualPrice =
      isFreeTrialPlan
        ? 0
        : annualPrice !== undefined
          ? Number(annualPrice)
          : (plan.annualPrice ?? finalMonthlyPrice * 12);
    const finalPrice = finalMonthlyPrice;
    const finalCurrency = currency ?? plan.currency;
    const finalDuration = isFreeTrialPlan ? 7 : 30;
    const finalDisplayOrder =
      displayOrder !== undefined ? Number(displayOrder) : plan.displayOrder;

    if (!isFreeTrialPlan && (finalPrice <= 0 || isFreeTrialPlanTitle(finalTitle))) {
      return errorResponse(
        res,
        'Only the system-managed Free Trial plan can be free',
        400,
      );
    }

    // Check if price, currency, or duration changed (need to update Stripe)
    const priceChanged =
      (monthlyPrice !== undefined && Number(monthlyPrice) !== (plan.monthlyPrice ?? plan.price)) ||
      (annualPrice !== undefined && Number(annualPrice) !== (plan.annualPrice ?? finalMonthlyPrice * 12)) ||
      (price !== undefined && Number(price) !== plan.price);
    const currencyChanged = currency !== undefined && currency !== plan.currency;
    const durationChanged = plan.duration !== finalDuration;
    const needsStripeUpdate =
      priceChanged || currencyChanged || durationChanged || title !== undefined;

    let stripeData: StripePlanData | null = isFreeTrialPlan
      ? {
          productId: null,
          priceId: null,
          monthlyPriceId: null,
          annualPriceId: null,
        }
      : null;

    // Only update Stripe if the plan is not free (price > 0)
    if (!isFreeTrialPlan && needsStripeUpdate && finalPrice > 0) {
      stripeData = await updateStripeProductAndPrice(
        plan.stripeProductId,
        finalTitle,
        finalDescription,
        finalPrice,
        finalCurrency,
        finalDuration,
        finalMonthlyPrice,
        finalAnnualPrice,
      );
    } else if (needsStripeUpdate && finalPrice === 0) {
      // For free plans, clear Stripe data if it exists
      stripeData = {
        productId: null,
        priceId: null,
        monthlyPriceId: null,
        annualPriceId: null,
      };
    }

    const updateData: any = {
      title: finalTitle,
      description: finalDescription,
      price: finalPrice,
      monthlyPrice: finalMonthlyPrice,
      annualPrice: finalAnnualPrice,
      currency: finalCurrency,
      isActive: isFreeTrialPlan
        ? true
        : isActive !== undefined
          ? Boolean(isActive)
          : plan.isActive,
      duration: finalDuration,
      displayOrder: finalDisplayOrder,
    };

    // Add Stripe IDs if updated
    if (stripeData) {
      updateData.stripeProductId = stripeData.productId;
      updateData.stripePriceId = stripeData.priceId;
      updateData.stripeMonthlyPriceId = stripeData.monthlyPriceId;
      updateData.stripeAnnualPriceId = stripeData.annualPriceId;
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

    if (isFreeTrialPlanTitle(plan.title)) {
      return errorResponse(res, 'Free trial plan is system-managed and cannot be deleted', 400);
    }

    await archiveStripeProduct(plan.stripeProductId);

    const subscriptionsCount = await prisma.subscription.count({
      where: { planId: Number(id) },
    });

    if (subscriptionsCount > 0) {
      const deactivated = await prisma.plan.update({
        where: { id: Number(id) },
        data: {
          isActive: false,
          stripeProductId: null,
          stripePriceId: null,
          stripeMonthlyPriceId: null,
          stripeAnnualPriceId: null,
        },
        include: { permissions: true },
      });

      return successResponse(
        res,
        'Plan has subscription history, so it was deactivated instead of deleted',
        deactivated,
      );
    }

    await prisma.$transaction([
      prisma.permission.deleteMany({ where: { planId: Number(id) } }),
      prisma.plan.delete({ where: { id: Number(id) } }),
    ]);

    return successResponse(res, 'Plan deleted successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      error instanceof Error ? error.message : 'Internal server error',
      500,
    );
  }
};
