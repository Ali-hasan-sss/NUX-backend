"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonSwaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
exports.commonSwaggerSpec = (0, swagger_jsdoc_1.default)({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Lolity App - Common API',
            version: '1.0.0',
            description: 'API documentation for Shared endpoints',
        },
        servers: [{ url: 'http://localhost:5000/api' }],
    },
    apis: ['./src/controllers/common/*.ts', './src/routes/common/*.ts'],
});
//# sourceMappingURL=common.swagger.js.map