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

dotenv.config();

const app = express();
app.use(express.json());

checkAndUpdateSubscriptions();
startSubscriptionChecker();

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// security + sanitizers
securityMiddleware(app);
app.use(xssSanitizerMiddleware);

app.use('/', swaggerRoutes);
// rate limiter (global)
app.use(generalRateLimiter);

app.use('/api', routes);

export default app;
