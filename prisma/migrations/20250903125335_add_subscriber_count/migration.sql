-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN     "subscriberCount" INTEGER NOT NULL DEFAULT 0;
-- update restaurant cont 
CREATE OR REPLACE FUNCTION update_plan_subscriber_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Plan"
    SET "subscriberCount" = "subscriberCount" + 1
    WHERE id = NEW."planId";
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Plan"
    SET "subscriberCount" = GREATEST("subscriberCount" - 1, 0);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

--Trigger work after insert and delete subscription
DROP TRIGGER IF EXISTS subscription_count_trigger ON "Subscription";

CREATE TRIGGER subscription_count_trigger
AFTER INSERT OR DELETE ON "Subscription"
FOR EACH ROW
EXECUTE FUNCTION update_plan_subscriber_count();
