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

// Set trust proxy before any rate limiter usage
app.set('trust proxy', 1);

// Apply rate limiter immediately after trust proxy
app.use(generalRateLimiter);

// Check subscriptions and start the job
checkAndUpdateSubscriptions();
startSubscriptionChecker();

// Basic middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security + sanitizers
securityMiddleware(app);
app.use(xssSanitizerMiddleware);

// Webhook route must be before any JSON parsing middleware
app.post(
  '/api/restaurants/subscription/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook,
);

// Documentation and Swagger
app.use('/', swaggerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
  });
});

// All API routes
app.use('/api', routes);

export default app;
