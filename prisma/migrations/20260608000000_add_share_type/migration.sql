-- Add share type preference to Client
ALTER TABLE "Client" ADD COLUMN "shareType" TEXT NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "Client" ADD COLUMN "defaultSharePercent" REAL;
ALTER TABLE "Client" ADD COLUMN "defaultShareAmount" REAL;

-- Add share type / amount to LineItem
ALTER TABLE "LineItem" ADD COLUMN "shareType" TEXT NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "LineItem" ADD COLUMN "shareAmount" REAL NOT NULL DEFAULT 0;
