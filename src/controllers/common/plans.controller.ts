import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * /api/plans:
 *   get:
 *     summary: Get all available plans with permissions
 *     tags: [Plans]
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       duration:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             type:
 *                               type: string
 *                             value:
 *                               type: integer
 *                               nullable: true
 *                             isUnlimited:
 *                               type: boolean
 *       500:
 *         description: Internal server error
 */
export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      include: {
        permissions: {
          select: {
            id: true,
            type: true,
            value: true,
            isUnlimited: true,
          },
        },
      },
      orderBy: {
        price: 'asc',
      },
    });

    return successResponse(res, 'Plans retrieved successfully', plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return errorResponse(res, 'Failed to fetch plans', 500);
  }
};

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Get a specific plan by ID with permissions
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     duration:
 *                       type: integer
 *                     isActive:
 *                       type: boolean
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           type:
 *                             type: string
 *                           value:
 *                             type: integer
 *                             nullable: true
 *                           isUnlimited:
 *                             type: boolean
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Internal server error
 */
export const getPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return errorResponse(res, 'Plan ID is required', 400);
    }
    const planId = parseInt(id);

    if (isNaN(planId)) {
      return errorResponse(res, 'Invalid plan ID', 400);
    }

    const plan = await prisma.plan.findUnique({
      where: {
        id: planId,
        isActive: true,
      },
      include: {
        permissions: {
          select: {
            id: true,
            type: true,
            value: true,
            isUnlimited: true,
          },
        },
      },
    });

    if (!plan) {
      return errorResponse(res, 'Plan not found', 404);
    }

    return successResponse(res, 'Plan retrieved successfully', plan);
  } catch (error) {
    console.error('Error fetching plan:', error);
    return errorResponse(res, 'Failed to fetch plan', 500);
  }
};
