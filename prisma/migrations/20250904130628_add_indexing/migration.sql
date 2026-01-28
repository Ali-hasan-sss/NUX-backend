-- CreateIndex
CREATE INDEX "Subscription_planId_status_idx" ON "public"."Subscription"("planId", "status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "public"."Subscription"("endDate");
