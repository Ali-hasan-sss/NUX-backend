"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSwaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
exports.adminSwaggerSpec = (0, swagger_jsdoc_1.default)({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Lolity App - Admin API',
            version: '1.0.0',
            description: 'API documentation for Admin endpoints',
        },
        servers: [{ url: 'http://localhost:5000/api' }],
    },
    apis: ['./src/controllers/admin/*.ts', './src/routes/admin/*.ts'],
});
//# sourceMappingURL=admin.swagger.js.map