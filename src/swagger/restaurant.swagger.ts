import swaggerJSDoc from 'swagger-jsdoc';

export const restaurantSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'nux - Restaurants API',
      version: '1.0.0',
      description: 'API documentation for restaurants endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
    tags: [
      {
        name: 'Restaurant wallet',
        description: 'Ledger balance for the restaurant (credits when customers pay with app wallet).',
      },
    ],
  },
  apis: [
    './src/controllers/restaurant/*.ts',
    './src/routes/restaurant/*.ts',
    './src/controllers/client/wallet.controller.ts',
  ],
});
