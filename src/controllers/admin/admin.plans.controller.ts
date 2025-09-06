import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
    const plans = await prisma.plan.findMany();
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
    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } });

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
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       500:
 *         description: Internal server error
 */
export const createPlan = async (req: Request, res: Response) => {
  try {
    const { title, description, currency, price, duration } = req.body;

    const plan = await prisma.plan.create({
      data: {
        title,
        description,
        price: Number(price),
        currency,
        duration: Number(duration),
      },
    });

    return successResponse(res, 'Plan created successfully', plan, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
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
    const { title, description, currency, price, duration, isActive } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: Number(id) } });
    if (!plan) return errorResponse(res, 'Plan not found', 404);

    const updated = await prisma.plan.update({
      where: { id: Number(id) },
      data: {
        title: title ?? plan.title,
        description: description ?? plan.description,
        price: price !== undefined ? Number(price) : plan.price,
        currency: currency ?? plan.currency,
        isActive: isActive !== undefined ? Boolean(isActive) : plan.isActive,
        duration: duration !== undefined ? Number(duration) : plan.duration,
      },
    });

    return successResponse(res, 'Plan updated successfully', updated);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Internal server error', 500);
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
