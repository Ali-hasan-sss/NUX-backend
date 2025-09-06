import swaggerJSDoc from 'swagger-jsdoc';

export const clientSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lolity App - Client API',
      version: '1.0.0',
      description: 'API documentation for Client endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
    tags: [
      { name: 'Account', description: 'Client Profile Endpoints' },
      { name: 'Auth', description: 'Client Requests Endpoints' },
    ],
  },
  apis: ['./src/controllers/client/*.ts', './src/routes/client/*.ts'],
});
