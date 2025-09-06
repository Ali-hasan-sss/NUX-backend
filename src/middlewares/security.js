"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xssSanitizerMiddleware = exports.errorHandler = exports.validateRequest = exports.loginRateLimiter = exports.generalRateLimiter = exports.securityMiddleware = exports.corsOptions = void 0;
// src/middleware/security.ts
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_validator_1 = require("express-validator");
const express_1 = __importDefault(require("express"));
const xss_1 = __importDefault(require("xss"));
/**
 * Exported middlewares:
 * - securityMiddleware(app)         -> mounts helmet, cors, body sanitizers, cookieParser
 * - generalRateLimiter              -> limited for all requests
 * - loginRateLimiter                -> stricter for /login
 * - csrfProtection                  -> CSRF middleware (use if you use cookies)
 * - validateRequest                 -> helper to use after express-validator checks
 * - errorHandler                    -> global error handler (prints server-side, hides details from client)
 */
// CORS options (adjust origin to your frontend domain)
exports.corsOptions = {
    origin: (origin, callback) => {
        // allow requests with no origin like mobile apps or curl
        if (!origin)
            return callback(null, true);
        const allowed = [
            'http://localhost:3000',
            'http://localhost:19006', // Expo / testing
        ];
        if (allowed.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};
const securityMiddleware = (app) => {
    // Set secure HTTP headers
    app.use((0, helmet_1.default)());
    // Parse cookies (required for CSRF if used)
    app.use((0, cookie_parser_1.default)());
    // CORS
    app.use((0, cors_1.default)(exports.corsOptions));
    // You can also set other express.json limits
    app.use(express_1.default.json
        ? express_1.default.json({ limit: '10kb' })
        : (req, _res, next) => next());
    // If using urlencoded bodies:
    app.use(express_1.default.urlencoded
        ? express_1.default.urlencoded({ extended: true, limit: '10kb' })
        : (req, _res, next) => next());
};
exports.securityMiddleware = securityMiddleware;
// General global rate limiter (apply early)
exports.generalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // max requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, try again later.' },
});
// Login-specific limiter to block brute force
exports.loginRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // only 5 attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Try again later.' },
});
// Helper to check express-validator results
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const mapped = errors.array().map((e) => {
            const err = e;
            return { field: err.param || 'unknown', message: err.msg };
        });
        return res.status(400).json({ success: false, message: 'Validation failed', errors: mapped });
    }
    next();
};
exports.validateRequest = validateRequest;
// Central error handler (put at end of middleware chain)
const errorHandler = (err, req, res, next) => {
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
exports.errorHandler = errorHandler;
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object')
        return;
    Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (typeof value === 'string') {
            obj[key] = (0, xss_1.default)(value);
        }
        else if (typeof value === 'object') {
            sanitizeObject(value);
        }
    });
}
const xssSanitizerMiddleware = (req, res, next) => {
    sanitizeObject(req.body);
    sanitizeObject(req.query);
    sanitizeObject(req.params);
    next();
};
exports.xssSanitizerMiddleware = xssSanitizerMiddleware;
//# sourceMappingURL=security.js.map