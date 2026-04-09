import swaggerJSDoc from 'swagger-jsdoc';

export const adminSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'nux - Admin API',
      version: '1.0.0',
      description: 'API documentation for Admin endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
    tags: [
      {
        name: 'Wallet (Admin)',
        description: 'Approve or reject user wallet withdrawal requests (ledger debit on approve).',
      },
    ],
  },
  apis: ['./src/controllers/admin/*.ts', './src/routes/admin/*.ts'],
});
