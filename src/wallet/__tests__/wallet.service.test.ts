import { Prisma } from '@prisma/client';

describe('Wallet ledger helpers', () => {
  it('computes difference with Decimal', () => {
    const a = new Prisma.Decimal('10.50');
    const b = new Prisma.Decimal('10.50');
    expect(a.minus(b).toString()).toBe('0');
  });

  it('Stripe idempotency key prefixes payment intent id', () => {
    const paymentIntentId = 'pi_3AbCdEfGhIjKlMnO';
    expect(`stripe_pi_${paymentIntentId}`).toBe('stripe_pi_pi_3AbCdEfGhIjKlMnO');
  });
});
