// src/config/swagger.config.ts
import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'nux API documentation',
      version: '1.0.0',
      description: 'Unified API documentation for Admin & Client',
    },
    tags: [
      { name: 'Admin', description: 'Admin endpoints' },
      { name: 'Client', description: 'Client endpoints' },
      { name: 'Common', description: 'Shared endpoints' },
      { name: 'Users', description: 'Admin users management endpoints' },
    ],
    servers: [{ url: 'http://localhost:5000/' }],
  },
  apis: [
    './src/controllers/**/*.ts', // يشمل كل الـ controllers
    './src/routes/**/*.ts', // يشمل كل الـ routes
  ],
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
