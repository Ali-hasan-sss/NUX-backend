"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restaurantSwaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
exports.restaurantSwaggerSpec = (0, swagger_jsdoc_1.default)({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Lolity App - Restaurants API',
            version: '1.0.0',
            description: 'API documentation for restaurants endpoints',
        },
        servers: [{ url: 'http://localhost:5000/api' }],
    },
    apis: ['./src/controllers/restaurant/*.ts', './src/routes/restaurant/*.ts'],
});
//# sourceMappingURL=restaurant.swagger.js.map