import { Request } from 'express';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0] || 'unknown';
  }
  const ip = req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  return String(ip).replace(/^::ffff:/, '') || 'unknown';
}

export function getDeviceInfo(req: Request): string {
  return (req.headers['user-agent'] as string) || 'unknown';
}
