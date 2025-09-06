"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const response_1 = require("../utils/response");
const jwt_1 = require("../config/jwt");
const prisma = new client_1.PrismaClient();
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, response_1.errorResponse)(res, 'No token provided', 401);
        }
        const token = authHeader.split(' ')[1];
        //console.log('Token:', token);
        if (!token) {
            return (0, response_1.errorResponse)(res, 'No token provided', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwt_1.ACCESS_TOKEN_SECRET);
        //console.log('Decoded Token:', decoded);
        if (typeof decoded !== 'object' ||
            decoded === null ||
            !('userId' in decoded) ||
            !('role' in decoded)) {
            return (0, response_1.errorResponse)(res, 'Invalid token payload', 401);
        }
        const payload = decoded;
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            console.log('User not found');
            return (0, response_1.errorResponse)(res, 'User not found', 401);
        }
        req.user = user;
        next();
    }
    catch (err) {
        console.log('Error in authenticateUser:', err);
        return (0, response_1.errorResponse)(res, 'Authentication failed', 401);
    }
};
exports.authenticateUser = authenticateUser;
//# sourceMappingURL=Auth.js.map