import Stripe from 'stripe';

let stripe: Stripe | null = null;

/** Shared Stripe client (subscriptions, wallet top-ups, etc.) */
export function getStripeClient(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new Stripe(key, { apiVersion: '2025-08-27.basil' });
  }
  return stripe;
}
