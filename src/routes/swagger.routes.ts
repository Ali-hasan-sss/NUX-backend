import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { adminSwaggerSpec } from '../swagger/admin.swagger';
import { clientSwaggerSpec } from '../swagger/client.swagger';
import { restaurantSwaggerSpec } from '../swagger/restaurant.swagger';
import { commonSwaggerSpec } from '../swagger/common.swagger';

const router = Router();

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

router.use('/swagger', swaggerUi.serve, swaggerUi.setup(undefined, swaggerOptions));

router.get('/swagger-json/admin', (req, res) => res.json(adminSwaggerSpec));
router.get('/swagger-json/client', (req, res) => res.json(clientSwaggerSpec));
router.get('/swagger-json/restaurant', (req, res) => res.json(restaurantSwaggerSpec));
router.get('/swagger-json/common', (req, res) => res.json(commonSwaggerSpec));

export default router;
