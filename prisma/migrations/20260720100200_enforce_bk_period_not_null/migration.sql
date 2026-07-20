-- Enforce NOT NULL on BookkeeperInvoice.periodStart/periodEnd now that all
-- rows have been backfilled. SQLite has no ALTER COLUMN, so rebuild the table.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_BookkeeperInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paymentTerms" TEXT NOT NULL DEFAULT '14 pv netto / 14 days net',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "bkName" TEXT NOT NULL,
    "bkBusinessId" TEXT NOT NULL,
    "bkVatId" TEXT NOT NULL,
    "bkAddress" TEXT NOT NULL,
    "bkPostalCode" TEXT NOT NULL,
    "bkCity" TEXT NOT NULL,
    "bkIban" TEXT NOT NULL,
    "bkBic" TEXT NOT NULL,
    "bkEmail" TEXT,
    "bkPhone" TEXT,
    "clientId" INTEGER,
    "clientName" TEXT NOT NULL,
    "clientBusinessId" TEXT,
    "clientVatId" TEXT,
    "clientAddress" TEXT,
    "clientPostalCode" TEXT,
    "clientCity" TEXT,
    "clientEmail" TEXT,
    "serviceDescription" TEXT NOT NULL,
    "amountExVat" REAL NOT NULL,
    "vatRate" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    "totalIncVat" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_BookkeeperInvoice" (
    "id", "invoiceNumber", "issueDate", "dueDate", "paymentTerms", "periodStart", "periodEnd",
    "bkName", "bkBusinessId", "bkVatId", "bkAddress", "bkPostalCode", "bkCity", "bkIban", "bkBic",
    "bkEmail", "bkPhone", "clientId", "clientName", "clientBusinessId", "clientVatId",
    "clientAddress", "clientPostalCode", "clientCity", "clientEmail", "serviceDescription",
    "amountExVat", "vatRate", "vatAmount", "totalIncVat", "notes", "createdAt", "updatedAt"
)
SELECT
    "id", "invoiceNumber", "issueDate", "dueDate", "paymentTerms", "periodStart", "periodEnd",
    "bkName", "bkBusinessId", "bkVatId", "bkAddress", "bkPostalCode", "bkCity", "bkIban", "bkBic",
    "bkEmail", "bkPhone", "clientId", "clientName", "clientBusinessId", "clientVatId",
    "clientAddress", "clientPostalCode", "clientCity", "clientEmail", "serviceDescription",
    "amountExVat", "vatRate", "vatAmount", "totalIncVat", "notes", "createdAt", "updatedAt"
FROM "BookkeeperInvoice";

DROP TABLE "BookkeeperInvoice";
ALTER TABLE "new_BookkeeperInvoice" RENAME TO "BookkeeperInvoice";

CREATE UNIQUE INDEX "BookkeeperInvoice_invoiceNumber_key" ON "BookkeeperInvoice"("invoiceNumber");
CREATE INDEX "BookkeeperInvoice_periodEnd_idx" ON "BookkeeperInvoice"("periodEnd");
CREATE INDEX "BookkeeperInvoice_issueDate_idx" ON "BookkeeperInvoice"("issueDate");
CREATE INDEX "BookkeeperInvoice_clientId_idx" ON "BookkeeperInvoice"("clientId");
CREATE INDEX "BookkeeperInvoice_bkBusinessId_idx" ON "BookkeeperInvoice"("bkBusinessId");

PRAGMA foreign_keys=ON;
