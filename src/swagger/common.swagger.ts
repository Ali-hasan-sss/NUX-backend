import swaggerJSDoc from 'swagger-jsdoc';

export const commonSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lolity App - Common API',
      version: '1.0.0',
      description: 'API documentation for Shared endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
  },
  apis: ['./src/controllers/common/*.ts', './src/routes/common/*.ts'],
});
