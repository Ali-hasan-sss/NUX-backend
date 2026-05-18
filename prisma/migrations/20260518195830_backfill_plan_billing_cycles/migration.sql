UPDATE "public"."Plan"
SET
  "monthlyPrice" = COALESCE("monthlyPrice", "price"),
  "annualPrice" = COALESCE("annualPrice", "price" * 12),
  "stripeMonthlyPriceId" = COALESCE("stripeMonthlyPriceId", "stripePriceId")
WHERE
  "monthlyPrice" IS NULL
  OR "annualPrice" IS NULL
  OR ("stripeMonthlyPriceId" IS NULL AND "stripePriceId" IS NOT NULL);
