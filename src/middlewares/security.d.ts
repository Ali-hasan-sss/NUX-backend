import { Request, Response, NextFunction } from 'express';
/**
 * Exported middlewares:
 * - securityMiddleware(app)         -> mounts helmet, cors, body sanitizers, cookieParser
 * - generalRateLimiter              -> limited for all requests
 * - loginRateLimiter                -> stricter for /login
 * - csrfProtection                  -> CSRF middleware (use if you use cookies)
 * - validateRequest                 -> helper to use after express-validator checks
 * - errorHandler                    -> global error handler (prints server-side, hides details from client)
 */
export declare const corsOptions: {
    origin: (origin: any, callback: any) => any;
    credentials: boolean;
};
export declare const securityMiddleware: (app: any) => void;
export declare const generalRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const loginRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const validateRequest: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
export declare const xssSanitizerMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map