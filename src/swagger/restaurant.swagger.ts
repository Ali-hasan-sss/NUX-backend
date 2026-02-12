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
  },
  apis: ['./src/controllers/restaurant/*.ts', './src/routes/restaurant/*.ts'],
});
