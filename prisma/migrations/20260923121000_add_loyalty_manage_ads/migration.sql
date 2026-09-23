-- Keep Manage Ads (Unlimited) on active NUX Loyalty without removing existing permissions
INSERT INTO "public"."Permission" ("type", "value", "isUnlimited", "planId")
SELECT 'MANAGE_ADS'::"PermissionType", NULL, true, p.id
FROM "public"."Plan" p
WHERE p."isActive" = true
  AND LOWER(p."title") LIKE '%loyalty%'
  AND LOWER(p."title") NOT LIKE '%starter%'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."Permission" perm
    WHERE perm."planId" = p.id
      AND perm."type" = 'MANAGE_ADS'
  );
