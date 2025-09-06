"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const admin_swagger_1 = require("../swagger/admin.swagger");
const client_swagger_1 = require("../swagger/client.swagger");
const restaurant_swagger_1 = require("../swagger/restaurant.swagger");
const common_swagger_1 = require("../swagger/common.swagger");
const router = (0, express_1.Router)();
const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
        urls: [
            { url: '/swagger-json/admin', name: 'Admin' },
            { url: '/swagger-json/client', name: 'Client' },
            { url: '/swagger-json/restaurant', name: 'restaurant' },
            { url: '/swagger-json/common', name: 'common' },
        ],
    },
};
router.use('/swagger', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(undefined, swaggerOptions));
router.get('/swagger-json/admin', (req, res) => res.json(admin_swagger_1.adminSwaggerSpec));
router.get('/swagger-json/client', (req, res) => res.json(client_swagger_1.clientSwaggerSpec));
router.get('/swagger-json/restaurant', (req, res) => res.json(restaurant_swagger_1.restaurantSwaggerSpec));
router.get('/swagger-json/common', (req, res) => res.json(common_swagger_1.commonSwaggerSpec));
exports.default = router;
//# sourceMappingURL=swagger.routes.js.map