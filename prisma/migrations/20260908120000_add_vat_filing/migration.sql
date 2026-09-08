-- What was actually FILED to Verohallinto for one client and one VAT period.
-- The books stay a live recomputation from raw entries; this is the separate
-- record of what was reported, so the two can be compared afterwards.
--
-- The figures are stored rather than derived on purpose: a receipt entered
-- after filing must change the books WITHOUT rewriting filing history, which
-- is exactly what makes a divergence detectable.
--
-- New table only — no backfill, so no ms-epoch DATETIME conversion is needed.
CREATE TABLE "VatFiling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "filedOn" DATETIME NOT NULL,
    "outputVat" REAL NOT NULL,
    "deductibleVat" REAL NOT NULL,
    "netVat" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VatFiling_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One filing record per client per period. Re-filing a period updates the
-- existing row rather than accumulating duplicates.
CREATE UNIQUE INDEX "VatFiling_clientId_year_periodKey_key" ON "VatFiling"("clientId", "year", "periodKey");
CREATE INDEX "VatFiling_clientId_year_idx" ON "VatFiling"("clientId", "year");
