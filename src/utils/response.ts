// helper/response.ts
import { Response } from 'express';

export const errorResponse = (
  res: Response,
  message: string,
  statusCode = 400,
  /** Optional machine-readable code for clients (e.g. WALLET_APPROVAL_NOT_FOUND) */
  errorCode?: string,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errorCode ? { code: errorCode } : {}),
  });
};

export const successResponse = (res: Response, message: string, data?: any, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data && { data }),
  });
};
