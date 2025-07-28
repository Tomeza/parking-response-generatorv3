-- Drop existing table if exists
DROP TABLE IF EXISTS "faq_usage_stats";

-- CreateTable
CREATE TABLE "faq_usage_stats" (
    "id" BIGSERIAL PRIMARY KEY,
    "faqId" INTEGER NOT NULL,
    "queryHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "route" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "queryText" TEXT NOT NULL,
    
    CONSTRAINT "faq_usage_stats_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "faq_raw"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "faq_usage_stats_faqId_idx" ON "faq_usage_stats"("faqId");
CREATE INDEX "faq_usage_stats_queryHash_idx" ON "faq_usage_stats"("queryHash");
CREATE INDEX "faq_usage_stats_usedAt_idx" ON "faq_usage_stats"("usedAt");

-- Add trigger for automatic usedAt update
CREATE OR REPLACE FUNCTION update_faq_usage_stats_usedAt()
RETURNS TRIGGER AS $$
BEGIN
    NEW."usedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_faq_usage_stats_usedAt_trigger
    BEFORE UPDATE ON "faq_usage_stats"
    FOR EACH ROW
    EXECUTE FUNCTION update_faq_usage_stats_usedAt(); 