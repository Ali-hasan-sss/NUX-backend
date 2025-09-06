import swaggerJSDoc from 'swagger-jsdoc';

export const adminSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lolity App - Admin API',
      version: '1.0.0',
      description: 'API documentation for Admin endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
  },
  apis: ['./src/controllers/admin/*.ts', './src/routes/admin/*.ts'],
});
