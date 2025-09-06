"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_EXPIRES_IN = exports.ACCESS_TOKEN_EXPIRES_IN = exports.REFRESH_TOKEN_SECRET = exports.ACCESS_TOKEN_SECRET = void 0;
//src/config/jwt.ts
exports.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
exports.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
exports.ACCESS_TOKEN_EXPIRES_IN = '15m';
exports.REFRESH_TOKEN_EXPIRES_IN = '7d';
//# sourceMappingURL=jwt.js.map