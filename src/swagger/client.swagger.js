"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientSwaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
exports.clientSwaggerSpec = (0, swagger_jsdoc_1.default)({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'nux - Client API',
            version: '1.0.0',
            description: 'API documentation for Client endpoints',
        },
        servers: [{ url: 'http://localhost:5000/api' }],
        tags: [
            { name: 'Account', description: 'Client Profile Endpoints' },
            { name: 'Auth', description: 'Client Requests Endpoints' },
        ],
    },
    apis: ['./src/controllers/client/*.ts', './src/routes/client/*.ts'],
});
//# sourceMappingURL=client.swagger.js.map