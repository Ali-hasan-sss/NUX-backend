import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';
import {
  securityMiddleware,
  generalRateLimiter,
  xssSanitizerMiddleware,
} from './middlewares/security';
import swaggerRoutes from './routes/swagger.routes';
import { checkAndUpdateSubscriptions, startSubscriptionChecker } from './jobs/subscriptionChecker';
import { stripeWebhook } from './controllers/restaurant/subscription.controller';

dotenv.config();

const app = express();

checkAndUpdateSubscriptions();
startSubscriptionChecker();

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));

// Webhook route must be defined BEFORE any JSON parsing middleware
app.post(
  '/api/restaurants/subscription/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook,
);

// Apply JSON parsing to all other routes
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// security + sanitizers
securityMiddleware(app);
app.use(xssSanitizerMiddleware);

app.use('/', swaggerRoutes);
// rate limiter (global)
app.use(generalRateLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
  });
});

app.use('/api', routes);

export default app;
