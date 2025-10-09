// src/middleware/security.ts
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { ValidationError, validationResult } from 'express-validator';
import express from 'express';
import xss from 'xss';
/**
 * Exported middlewares:
 * - securityMiddleware(app)         -> mounts helmet, cors, body sanitizers, cookieParser
 * - generalRateLimiter              -> limited for all requests
 * - loginRateLimiter                -> stricter for /login
 * - csrfProtection                  -> CSRF middleware (use if you use cookies)
 * - validateRequest                 -> helper to use after express-validator checks
 * - errorHandler                    -> global error handler (prints server-side, hides details from client)
 */

// CORS options - Allow all origins for development and deployment
export const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

export const securityMiddleware = (app: any) => {
  // Set secure HTTP headers
  app.use(helmet());

  // Parse cookies (required for CSRF if used)
  app.use(cookieParser());

  // CORS
  app.use(cors(corsOptions));

  // You can also set other express.json limits
  app.use(
    express.json
      ? express.json({ limit: '10kb' })
      : (req: Request, _res: Response, next: NextFunction) => next(),
  );
  // If using urlencoded bodies:
  app.use(
    express.urlencoded
      ? express.urlencoded({ extended: true, limit: '10kb' })
      : (req: Request, _res: Response, next: NextFunction) => next(),
  );
};

// General global rate limiter (apply early)
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later.' },
  // Skip rate limiting for health check
  skip: (req) => req.path === '/api/health',
  // Use the built-in IP extraction with IPv6 support
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ipKeyGenerator(ip);
  },
});

// Login-specific limiter to block brute force
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // only 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
  // Use the built-in IP extraction with IPv6 support
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ipKeyGenerator(ip);
  },
});

// Helper to check express-validator results
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const mapped = errors.array().map((e) => {
      const err = e as ValidationError & { param?: string };
      return { field: err.param || 'unknown', message: err.msg };
    });
    return res.status(400).json({ success: false, message: 'Validation failed', errors: mapped });
  }
  next();
};

// Central error handler (put at end of middleware chain)
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Print details only to server logs
  console.error('Unhandled error:', err);

  // Hide internal details from clients
  if (res.headersSent) {
    return next(err);
  }
  res
    .status(err.status || 500)
    .json({ success: false, message: err.clientMessage || 'An unexpected error occurred' });
};

function sanitizeObject(obj: any) {
  if (!obj || typeof obj !== 'object') return;

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    if (typeof value === 'string') {
      obj[key] = xss(value);
    } else if (typeof value === 'object') {
      sanitizeObject(value);
    }
  });
}

export const xssSanitizerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);
  next();
};
