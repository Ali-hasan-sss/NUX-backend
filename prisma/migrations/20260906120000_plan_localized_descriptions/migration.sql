-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN "descriptionEn" TEXT,
ADD COLUMN "descriptionAr" TEXT,
ADD COLUMN "descriptionDe" TEXT,
ADD COLUMN "descriptionTr" TEXT,
ADD COLUMN "priceOnRequest" BOOLEAN NOT NULL DEFAULT false;

-- Backfill English from the existing single description
UPDATE "public"."Plan"
SET "descriptionEn" = "description"
WHERE "description" IS NOT NULL
  AND TRIM("description") <> ''
  AND "descriptionEn" IS NULL;
