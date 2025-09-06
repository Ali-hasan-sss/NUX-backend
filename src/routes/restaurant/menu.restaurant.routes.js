"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/menu.routes.ts
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const menu_controller_1 = require("../../controllers/restaurant/menu.controller");
const security_1 = require("../../middlewares/security");
const Auth_1 = require("../../middlewares/Auth");
const router = (0, express_1.Router)();
// get menu for restaurant
router.get('/', Auth_1.authenticateUser, menu_controller_1.getMenu);
router.post('/categories', Auth_1.authenticateUser, (0, express_validator_1.body)('title').isString().notEmpty(), (0, express_validator_1.body)('description').optional().isString(), (0, express_validator_1.body)('image').optional().isString().isURL().withMessage(' inviled image url'), security_1.validateRequest, menu_controller_1.createCategory);
router.put('/categories/:categoryId', Auth_1.authenticateUser, (0, express_validator_1.body)('title').optional().isString(), (0, express_validator_1.body)('description').optional().isString(), (0, express_validator_1.body)('image').optional().isString().isURL().withMessage(' inviled image url'), security_1.validateRequest, menu_controller_1.updateCategory);
router.delete('/categories/:categoryId', Auth_1.authenticateUser, (0, express_validator_1.param)('categoryId').isInt(), security_1.validateRequest, menu_controller_1.deleteCategory);
router.get('/items/:categoryId', Auth_1.authenticateUser, menu_controller_1.getMenuItemsByCategory);
router.post('/items/:categoryId', Auth_1.authenticateUser, (0, express_validator_1.param)('categoryId').isInt(), (0, express_validator_1.body)('title').isString().notEmpty(), (0, express_validator_1.body)('description').optional().isString(), (0, express_validator_1.body)('price').isFloat({ gt: 0 }), (0, express_validator_1.body)('image').optional().isString().isURL().withMessage(' inviled image url'), security_1.validateRequest, menu_controller_1.createMenuItem);
router.put('/items/:itemId', Auth_1.authenticateUser, (0, express_validator_1.param)('itemId').isInt(), (0, express_validator_1.body)('title').optional().isString(), (0, express_validator_1.body)('description').optional().isString(), (0, express_validator_1.body)('price').optional().isFloat({ gt: 0 }), (0, express_validator_1.body)('image').optional().isString().isURL().withMessage(' inviled image url'), security_1.validateRequest, menu_controller_1.updateMenuItem);
router.delete('/items/:itemId', Auth_1.authenticateUser, (0, express_validator_1.param)('itemId').isInt(), security_1.validateRequest, menu_controller_1.deleteMenuItem);
exports.default = router;
//# sourceMappingURL=menu.restaurant.routes.js.map