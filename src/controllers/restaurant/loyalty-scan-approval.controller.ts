import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../../utils/response';
import {
  approveLoyaltyScan,
  listPendingForRestaurant,
  LoyaltyScanApprovalError,
  rejectLoyaltyScan,
} from '../../services/loyaltyScanApproval.service';

function restaurantIdFromReq(req: Request): string | null {
  return (req as any).restaurant?.id ?? null;
}

export const getPendingLoyaltyScanApprovals = async (req: Request, res: Response) => {
  try {
    const restaurantId = restaurantIdFromReq(req);
    if (!restaurantId) {
      return errorResponse(res, 'Restaurant not found', 404);
    }
    const pending = await listPendingForRestaurant(restaurantId);
    return successResponse(res, 'Pending loyalty scans fetched', pending);
  } catch (error) {
    console.error('Get pending loyalty scans error:', error);
    return errorResponse(res, 'Failed to fetch pending loyalty scans', 500);
  }
};

export const approveLoyaltyScanRequest = async (req: Request, res: Response) => {
  try {
    const restaurantId = restaurantIdFromReq(req);
    if (!restaurantId) {
      return errorResponse(res, 'Restaurant not found', 404);
    }
    const approvalId = String(req.params.id ?? '').trim();
    if (!approvalId) {
      return errorResponse(res, 'Approval ID is required', 400);
    }
    const result = await approveLoyaltyScan(approvalId, restaurantId);
    return successResponse(res, 'Loyalty scan approved', result);
  } catch (error) {
    if (error instanceof LoyaltyScanApprovalError) {
      return errorResponse(res, error.message, error.statusCode, error.code);
    }
    console.error('Approve loyalty scan error:', error);
    return errorResponse(res, 'Failed to approve loyalty scan', 500);
  }
};

export const rejectLoyaltyScanRequest = async (req: Request, res: Response) => {
  try {
    const restaurantId = restaurantIdFromReq(req);
    if (!restaurantId) {
      return errorResponse(res, 'Restaurant not found', 404);
    }
    const approvalId = String(req.params.id ?? '').trim();
    if (!approvalId) {
      return errorResponse(res, 'Approval ID is required', 400);
    }
    const result = await rejectLoyaltyScan(approvalId, restaurantId);
    return successResponse(res, 'Loyalty scan rejected', result);
  } catch (error) {
    if (error instanceof LoyaltyScanApprovalError) {
      return errorResponse(res, error.message, error.statusCode, error.code);
    }
    console.error('Reject loyalty scan error:', error);
    return errorResponse(res, 'Failed to reject loyalty scan', 500);
  }
};
