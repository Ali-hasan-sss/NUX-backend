"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const security_1 = require("./middlewares/security");
const swagger_routes_1 = __importDefault(require("./routes/swagger.routes"));
const subscriptionChecker_1 = require("./jobs/subscriptionChecker");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
(0, subscriptionChecker_1.checkAndUpdateSubscriptions)();
(0, subscriptionChecker_1.startSubscriptionChecker)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// security + sanitizers
(0, security_1.securityMiddleware)(app);
app.use(security_1.xssSanitizerMiddleware);
app.use('/', swagger_routes_1.default);
// rate limiter (global)
app.use(security_1.generalRateLimiter);
app.use('/api', routes_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map