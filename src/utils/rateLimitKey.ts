import { Request } from 'express';

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * Client IP for rate limiting (first hop in X-Forwarded-For when trust proxy is set).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  let ip: string | undefined;

  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0]?.trim();
  } else if (Array.isArray(forwarded)) {
    ip = forwarded[0];
  } else {
    ip = req.socket?.remoteAddress;
  }

  if (!ip) ip = req.ip ?? 'unknown';

  return ip.replace('::ffff:', '') || 'unknown';
}

/**
 * Per-browser / per-app-install id sent by clients (X-Device-Id).
 * Separates devices on the same NAT / Wi‑Fi.
 */
export function getClientDeviceId(req: Request): string | null {
  const raw = (req.get('X-Device-Id') || req.get('x-device-id') || '').trim();
  if (!raw || !DEVICE_ID_RE.test(raw)) return null;
  return raw;
}

export type RateLimitKeyOptions = {
  /** Include authenticated user id when present (wallet routes). */
  useUserId?: boolean;
};

/**
 * Rate-limit bucket: IP + device (+ optional user).
 * Without X-Device-Id, falls back to IP-only (legacy clients).
 */
export function getRateLimitKey(req: Request, options: RateLimitKeyOptions = {}): string {
  const ip = getClientIp(req);
  const deviceId = getClientDeviceId(req);
  const channel = (req.get('X-Client-Channel') || 'unknown').toLowerCase().slice(0, 16);

  if (options.useUserId) {
    const uid = (req as Request & { user?: { id?: string } }).user?.id;
    if (uid) {
      const dev = deviceId ?? 'nodevice';
      return `u:${uid}:${dev}`;
    }
  }

  if (deviceId) {
    return `${channel}:${ip}:${deviceId}`;
  }

  return `${channel}:${ip}`;
}
