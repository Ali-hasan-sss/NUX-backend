-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN "isPopular" BOOLEAN NOT NULL DEFAULT false;

-- One Most Popular badge: NUX Gastro Pro
UPDATE "public"."Plan"
SET "isPopular" = false;

UPDATE "public"."Plan"
SET "isPopular" = true
WHERE "isActive" = true
  AND LOWER("title") LIKE '%gastro%'
  AND LOWER("title") LIKE '%pro%';

-- Add Customer Loyalty to active NUX Loyalty without removing existing permissions
INSERT INTO "public"."Permission" ("type", "value", "isUnlimited", "planId")
SELECT 'CUSTOMER_LOYALTY'::"PermissionType", NULL, true, p.id
FROM "public"."Plan" p
WHERE p."isActive" = true
  AND LOWER(p."title") LIKE '%loyalty%'
  AND LOWER(p."title") NOT LIKE '%starter%'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."Permission" perm
    WHERE perm."planId" = p.id
      AND perm."type" = 'CUSTOMER_LOYALTY'
  );
