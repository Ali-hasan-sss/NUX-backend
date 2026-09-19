import "dotenv/config";
import { PrismaClient, PermissionType } from "@prisma/client";
import Stripe from "stripe";

const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

type CatalogKey = "loyalty" | "menu" | "starter-plus" | "gastro-pro" | "enterprise";

const CATALOG: Record<
  CatalogKey,
  {
    title: string;
    monthly: number;
    annual: number;
    displayOrder: number;
    priceOnRequest?: boolean;
    createPermissions?: Array<{
      type: PermissionType;
      value: number | null;
      isUnlimited: boolean;
    }>;
  }
> = {
  loyalty: {
    title: "NUX Loyalty",
    monthly: 6.9,
    annual: 74.4,
    displayOrder: 1,
  },
  menu: {
    title: "NUX Menu",
    monthly: 8.9,
    annual: 95.9,
    displayOrder: 2,
  },
  "starter-plus": {
    title: "NUX Starter Plus",
    monthly: 12.9,
    annual: 138.4,
    displayOrder: 3,
    createPermissions: [
      { type: "MANAGE_MENU", value: null, isUnlimited: true },
      { type: "MANAGE_QR_CODES", value: null, isUnlimited: true },
    ],
  },
  "gastro-pro": {
    title: "NUX Gastro Pro",
    monthly: 34.9,
    annual: 376.9,
    displayOrder: 4,
    createPermissions: [
      { type: "MANAGE_ORDERS", value: null, isUnlimited: true },
    ],
  },
  enterprise: {
    title: "NUX Enterprise",
    monthly: 0,
    annual: 0,
    displayOrder: 5,
    priceOnRequest: true,
    createPermissions: [
      { type: "API_ACCESS", value: null, isUnlimited: true },
      { type: "MULTI_LOCATION", value: null, isUnlimited: true },
      { type: "MAX_GROUP_MEMBERS", value: null, isUnlimited: false },
    ],
  },
};

function classify(title: string): CatalogKey | "order" | "free-trial" | null {
  const t = title.toLowerCase().trim();
  if (t === "free trial") return "free-trial";
  if (t.includes("enterprise")) return "enterprise";
  if (t.includes("starter") && t.includes("plus")) return "starter-plus";
  if (t.includes("gastro") && t.includes("pro")) return "gastro-pro";
  if (t.includes("loyalty")) return "loyalty";
  if (t.includes("menu")) return "menu";
  if (/\border\b/.test(t)) return "order";
  return null;
}

async function syncStripe(opts: {
  productId: string | null;
  title: string;
  monthly: number;
  annual: number;
  currency: string;
}): Promise<{
  productId: string | null;
  priceId: string | null;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
} | null> {
  if (!stripe || opts.monthly <= 0) return null;
  try {
    let productId = opts.productId;
    if (productId) {
      try {
        await stripe.products.update(productId, { name: opts.title, active: true });
      } catch (error: any) {
        if (error?.code !== "resource_missing" && error?.statusCode !== 404) throw error;
        productId = null;
      }
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: opts.title,
        metadata: { type: "subscription_plan" },
      });
      productId = product.id;
    }
    const monthly = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(opts.monthly * 100),
      currency: opts.currency.toLowerCase(),
      recurring: { interval: "month", interval_count: 1 },
      metadata: { billing_cycle: "monthly" },
    });
    const annual = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(opts.annual * 100),
      currency: opts.currency.toLowerCase(),
      recurring: { interval: "year", interval_count: 1 },
      metadata: { billing_cycle: "annual" },
    });
    return {
      productId,
      priceId: monthly.id,
      monthlyPriceId: monthly.id,
      annualPriceId: annual.id,
    };
  } catch (error) {
    console.warn(`Stripe sync skipped for ${opts.title}:`, (error as Error).message);
    return null;
  }
}

async function upsertCatalogPlan(
  key: CatalogKey,
  existing: { id: number; stripeProductId: string | null } | null,
) {
  const spec = CATALOG[key];
  const priceOnRequest = Boolean(spec.priceOnRequest);
  const stripeData = priceOnRequest
    ? null
    : await syncStripe({
        productId: existing?.stripeProductId ?? null,
        title: spec.title,
        monthly: spec.monthly,
        annual: spec.annual,
        currency: "EUR",
      });

  const data = {
    title: spec.title,
    price: spec.monthly,
    monthlyPrice: spec.monthly,
    annualPrice: spec.annual,
    currency: "EUR",
    duration: 30,
    displayOrder: spec.displayOrder,
    isActive: true,
    priceOnRequest,
    ...(stripeData
      ? {
          stripeProductId: stripeData.productId,
          stripePriceId: stripeData.priceId,
          stripeMonthlyPriceId: stripeData.monthlyPriceId,
          stripeAnnualPriceId: stripeData.annualPriceId,
        }
      : {}),
  };

  if (existing) {
    await prisma.plan.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.plan.create({
    data: {
      ...data,
      permissions: spec.createPermissions
        ? { create: spec.createPermissions }
        : undefined,
    },
  });
  return created.id;
}

async function main() {
  const plans = await prisma.plan.findMany();
  const byClass = new Map<string, typeof plans>();
  for (const plan of plans) {
    const key = classify(plan.title);
    if (!key) continue;
    const list = byClass.get(key) ?? [];
    list.push(plan);
    byClass.set(key, list);
  }

  const pickPreferred = (key: string) => {
    const list = byClass.get(key) ?? [];
    return list.find((p) => p.isActive) ?? list[0] ?? null;
  };

  const orderPlan = pickPreferred("order");
  const gastroPlans = byClass.get("gastro-pro") ?? [];
  let gastroTarget = pickPreferred("gastro-pro");

  if (orderPlan) {
    for (const oldGastro of gastroPlans) {
      if (oldGastro.id !== orderPlan.id) {
        await prisma.plan.update({
          where: { id: oldGastro.id },
          data: { isActive: false },
        });
        console.log(
          `Kept old Gastro Pro inactive (id=${oldGastro.id}, title=${oldGastro.title})`,
        );
      }
    }
    gastroTarget = orderPlan;
  } else if (gastroPlans.length > 1) {
    const keep = gastroTarget;
    for (const extra of gastroPlans) {
      if (keep && extra.id !== keep.id) {
        await prisma.plan.update({
          where: { id: extra.id },
          data: { isActive: false },
        });
        console.log(
          `Kept extra Gastro Pro inactive (id=${extra.id}, title=${extra.title})`,
        );
      }
    }
  }

  const loyalty = pickPreferred("loyalty");
  const menu = pickPreferred("menu");
  const starter = pickPreferred("starter-plus");
  const enterprise = pickPreferred("enterprise");

  const loyaltyId = await upsertCatalogPlan(
    "loyalty",
    loyalty ? { id: loyalty.id, stripeProductId: loyalty.stripeProductId } : null,
  );
  const menuId = await upsertCatalogPlan(
    "menu",
    menu ? { id: menu.id, stripeProductId: menu.stripeProductId } : null,
  );
  const starterId = await upsertCatalogPlan(
    "starter-plus",
    starter ? { id: starter.id, stripeProductId: starter.stripeProductId } : null,
  );
  const gastroId = await upsertCatalogPlan(
    "gastro-pro",
    gastroTarget
      ? { id: gastroTarget.id, stripeProductId: gastroTarget.stripeProductId }
      : null,
  );
  const enterpriseId = await upsertCatalogPlan(
    "enterprise",
    enterprise
      ? { id: enterprise.id, stripeProductId: enterprise.stripeProductId }
      : null,
  );

  const keepIds = new Set([loyaltyId, menuId, starterId, gastroId, enterpriseId]);
  const extras = await prisma.plan.findMany({
    where: {
      isActive: true,
      id: { notIn: [...keepIds] },
      NOT: { title: "Free Trial" },
    },
  });
  for (const extra of extras) {
    await prisma.plan.update({
      where: { id: extra.id },
      data: { isActive: false },
    });
    console.log(
      `Deactivated leftover public plan without deleting it (id=${extra.id}, title=${extra.title})`,
    );
  }

  const finalPlans = await prisma.plan.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      monthlyPrice: true,
      annualPrice: true,
      isActive: true,
      priceOnRequest: true,
      displayOrder: true,
    },
  });
  console.log(JSON.stringify(finalPlans, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
