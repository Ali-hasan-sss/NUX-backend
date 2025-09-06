"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Auth_1 = require("../../middlewares/Auth");
const notifications_controller_1 = require("../../controllers/common/notifications.controller");
const router = (0, express_1.Router)();
router.get('/', Auth_1.authenticateUser, notifications_controller_1.getAllNotifications);
router.put('/read/:id', Auth_1.authenticateUser, notifications_controller_1.markNotification);
router.put('/read-all', Auth_1.authenticateUser, notifications_controller_1.markAllAsRead);
router.get('/count', Auth_1.authenticateUser, notifications_controller_1.getUnreadCount);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map