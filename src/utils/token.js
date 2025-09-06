"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
//src/utils/token.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_1 = require("../config/jwt");
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, jwt_1.ACCESS_TOKEN_SECRET, {
        expiresIn: jwt_1.ACCESS_TOKEN_EXPIRES_IN,
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, jwt_1.REFRESH_TOKEN_SECRET, {
        expiresIn: jwt_1.REFRESH_TOKEN_EXPIRES_IN,
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyAccessToken = (token) => jsonwebtoken_1.default.verify(token, jwt_1.ACCESS_TOKEN_SECRET);
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => jsonwebtoken_1.default.verify(token, jwt_1.REFRESH_TOKEN_SECRET);
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=token.js.map