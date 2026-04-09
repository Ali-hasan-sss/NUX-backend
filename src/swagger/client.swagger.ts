import swaggerJSDoc from 'swagger-jsdoc';

export const clientSwaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'nux - Client API',
      version: '1.0.0',
      description: 'API documentation for Client endpoints',
    },
    servers: [{ url: 'http://localhost:5000/api' }],
    tags: [
      { name: 'Account', description: 'Client Profile Endpoints' },
      { name: 'Auth', description: 'Client Requests Endpoints' },
      {
        name: 'Wallet',
        description:
          'Ledger-based internal wallet (EUR). Top-up via Stripe PaymentIntent; pay any restaurant; withdrawal requests. Aliases: same handlers under /wallet/* mirror /client/wallet/*.',
      },
    ],
  },
  apis: ['./src/controllers/client/*.ts', './src/routes/client/*.ts'],
});
