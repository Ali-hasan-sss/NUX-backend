"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/swagger.config.ts
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'nux API documentation',
            version: '1.0.0',
            description: 'Unified API documentation for Admin & Client',
        },
        tags: [
            { name: 'Admin', description: 'Admin endpoints' },
            { name: 'Client', description: 'Client endpoints' },
            { name: 'Common', description: 'Shared endpoints' },
            { name: 'Users', description: 'Admin users management endpoints' },
        ],
        servers: [{ url: 'http://localhost:5000/' }],
    },
    apis: [
        './src/controllers/**/*.ts', // يشمل كل الـ controllers
        './src/routes/**/*.ts', // يشمل كل الـ routes
    ],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.default = swaggerSpec;
//# sourceMappingURL=swaggerConfig.js.map