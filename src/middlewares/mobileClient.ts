import { Request, Response, NextFunction } from 'express';

/**
 * Identifies native mobile app traffic (not subject to browser CORS).
 * Optional MOBILE_APP_API_KEY — when set, mobile requests must send X-Mobile-Api-Key.
 * In development, if the env key is unset, mobile channel is accepted without a key.
 */
export function mobileClientMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const channel = (req.get('X-Client-Channel') || '').toLowerCase();
  if (channel !== 'mobile') {
    next();
    return;
  }

  const expectedKey = process.env.MOBILE_APP_API_KEY?.trim();
  if (!expectedKey) {
    next();
    return;
  }

  const provided = req.get('X-Mobile-Api-Key')?.trim();
  if (provided && provided === expectedKey) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Invalid or missing mobile API key',
  });
}
