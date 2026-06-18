-- Add tipsExVat column to OwnerIncomePeriod (0% VAT tips income)
ALTER TABLE "OwnerIncomePeriod" ADD COLUMN "tipsExVat" REAL NOT NULL DEFAULT 0;
