import { Request, Response } from 'express';
import { Prisma, PrismaClient, WalletTopUpBonusType } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { sendNotificationToUsersBulk } from '../../services/notification.service';

const prisma = new PrismaClient();

function buildPromoNotificationBody(params: {
  description: string | null;
  minTopUpAmount: Prisma.Decimal;
  bonusType: WalletTopUpBonusType;
  bonusValue: Prisma.Decimal;
  startsAt: Date;
  endsAt: Date;
}): string {
  const min = params.minTopUpAmount.toString();
  const bonusLine =
    params.bonusType === 'FIXED'
      ? `Bonus: +${params.bonusValue.toString()} EUR extra wallet credit when you top up at least ${min} EUR.`
      : `Bonus: +${params.bonusValue.toString()}% extra credit on your top-up amount (min. top-up ${min} EUR).`;
  const window = `Valid: ${params.startsAt.toISOString()} → ${params.endsAt.toISOString()}`;
  const head = params.description?.trim() ? `${params.description.trim()}\n\n` : '';
  return `${head}${bonusLine}\n${window}`;
}

/**
 * @swagger
 * /admin/wallet/top-up-bonuses:
 *   get:
 *     summary: List wallet top-up bonus campaigns (admin)
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of campaigns
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 */
export const listWalletTopUpBonusCampaigns = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.walletTopUpBonusCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, email: true, fullName: true } },
      },
    });
    return successResponse(res, 'Top-up bonus campaigns', items);
  } catch (e) {
    console.error('listWalletTopUpBonusCampaigns', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /admin/wallet/top-up-bonuses:
 *   post:
 *     summary: Create a customer wallet top-up bonus campaign (admin)
 *     description: >
 *       Applies to app customers (role USER) only, on successful Stripe wallet top-ups in EUR.
 *       When sendNotification is true (default), all active customers receive a push/in-app notification.
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startsAt, endsAt, minTopUpAmount, bonusType, bonusValue]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *               minTopUpAmount:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               bonusType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *               bonusValue:
 *                 type: number
 *                 exclusiveMinimum: 0
 *               sendNotification:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Campaign created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not admin
 */
export const createWalletTopUpBonusCampaign = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const {
      title,
      description,
      startsAt: startsRaw,
      endsAt: endsRaw,
      minTopUpAmount: minRaw,
      bonusType: bonusTypeRaw,
      bonusValue: bonusValRaw,
      sendNotification: notifyRaw,
    } = req.body as {
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      minTopUpAmount?: number;
      bonusType?: string;
      bonusValue?: number;
      sendNotification?: boolean;
    };

    const titleTrim = typeof title === 'string' ? title.trim() : '';
    if (!titleTrim) {
      return errorResponse(res, 'title is required', 400);
    }

    const startsAt = startsRaw ? new Date(startsRaw) : null;
    const endsAt = endsRaw ? new Date(endsRaw) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return errorResponse(res, 'startsAt must be a valid date', 400);
    }
    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return errorResponse(res, 'endsAt must be a valid date', 400);
    }
    if (endsAt <= startsAt) {
      return errorResponse(res, 'endsAt must be after startsAt', 400);
    }

    if (minRaw == null || !Number.isFinite(Number(minRaw)) || Number(minRaw) <= 0) {
      return errorResponse(res, 'minTopUpAmount must be a positive number', 400);
    }

    if (bonusTypeRaw !== 'PERCENTAGE' && bonusTypeRaw !== 'FIXED') {
      return errorResponse(res, 'bonusType must be PERCENTAGE or FIXED', 400);
    }
    if (bonusValRaw == null || !Number.isFinite(Number(bonusValRaw)) || Number(bonusValRaw) <= 0) {
      return errorResponse(res, 'bonusValue must be a positive number', 400);
    }

    const bonusValue = new Prisma.Decimal(String(bonusValRaw));
    if (bonusTypeRaw === 'PERCENTAGE' && bonusValue.gt(100)) {
      return errorResponse(res, 'bonusValue for PERCENTAGE cannot exceed 100', 400);
    }

    const minTopUpAmount = new Prisma.Decimal(String(minRaw));
    const sendNotification = notifyRaw !== false;

    const row = await prisma.walletTopUpBonusCampaign.create({
      data: {
        title: titleTrim,
        description: typeof description === 'string' ? description.trim() || null : null,
        startsAt,
        endsAt,
        minTopUpAmount,
        bonusType: bonusTypeRaw as WalletTopUpBonusType,
        bonusValue,
        createdById: adminId,
      },
      include: {
        creator: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (sendNotification) {
      const customers = await prisma.user.findMany({
        where: { role: 'USER', isActive: true },
        select: { id: true },
      });
      const userIds = customers.map((u) => u.id);
      if (userIds.length > 0) {
        const body = buildPromoNotificationBody({
          description: row.description,
          minTopUpAmount: row.minTopUpAmount,
          bonusType: row.bonusType,
          bonusValue: row.bonusValue,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        });
        await sendNotificationToUsersBulk({
          userIds,
          title: row.title,
          body,
          type: 'WALLET_TOP_UP_BONUS',
          data: { campaignId: row.id },
        });
      }
    }

    return successResponse(res, 'Top-up bonus campaign created', row, 201);
  } catch (e) {
    console.error('createWalletTopUpBonusCampaign', e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /admin/wallet/top-up-bonuses/{id}:
 *   patch:
 *     summary: Update wallet top-up bonus campaign (admin)
 *     description: Currently supports toggling isActive.
 *     tags: [Wallet (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
export const patchWalletTopUpBonusCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, 'id required', 400);

    const { isActive } = req.body as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
      return errorResponse(res, 'isActive boolean required', 400);
    }

    const existing = await prisma.walletTopUpBonusCampaign.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, 'Campaign not found', 404);
    }

    const row = await prisma.walletTopUpBonusCampaign.update({
      where: { id },
      data: { isActive },
      include: {
        creator: { select: { id: true, email: true, fullName: true } },
      },
    });

    return successResponse(res, 'Campaign updated', row);
  } catch (e) {
    console.error('patchWalletTopUpBonusCampaign', e);
    return errorResponse(res, 'Server error', 500);
  }
};
