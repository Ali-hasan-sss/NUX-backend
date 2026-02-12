/**
 * PayPal REST API helpers for subscription checkout (create order, capture).
 * Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in env.
 */

const PAYPAL_API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required');

  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return data.access_token;
}

export interface CreateOrderParams {
  amount: number;
  currency: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const token = await getAccessToken();

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: params.currency,
          value: params.amount.toFixed(2),
        },
        description: params.description || 'Subscription plan',
      },
    ],
    application_context: {
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      brand_name: 'NUX',
    },
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${err}`);
  }

  const data = (await res.json()) as { id: string; status: string; links: Array<{ href: string; rel: string }> };
  const approveLink = data.links?.find((l) => l.rel === 'approve');
  if (!approveLink?.href) throw new Error('PayPal order missing approval link');

  return { orderId: data.id, approvalUrl: approveLink.href };
}

export async function capturePayPalOrder(orderId: string): Promise<{ status: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${err}`);
  }

  const data = (await res.json()) as { status: string };
  return { status: data.status };
}

export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
