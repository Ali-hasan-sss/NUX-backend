"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Auth_1 = require("../../middlewares/Auth");
const ads_client_controller_1 = require("../../controllers/common/ads.client.controller");
const router = (0, express_1.Router)();
router.get('/', Auth_1.authenticateUser, ads_client_controller_1.getAdsForAll);
exports.default = router;
//# sourceMappingURL=ads.routes.js.map