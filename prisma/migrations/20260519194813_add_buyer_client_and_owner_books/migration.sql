-- CreateTable
CREATE TABLE "OwnerIncomePeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "description" TEXT,
    "woltInvoiceRef" TEXT,
    "totalExVat" REAL NOT NULL,
    "vatRate" REAL NOT NULL DEFAULT 25.5,
    "vatAmount" REAL NOT NULL,
    "totalIncVat" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerIncomePeriod_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnerExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amountExVat" REAL NOT NULL,
    "vatRate" REAL NOT NULL DEFAULT 25.5,
    "vatAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "receiptRef" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerExpense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paymentTerms" TEXT NOT NULL DEFAULT '14 pv netto / 14 days net',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "sellerPostalCode" TEXT NOT NULL,
    "sellerCity" TEXT NOT NULL,
    "sellerBusinessId" TEXT NOT NULL,
    "sellerVatId" TEXT NOT NULL,
    "sellerIban" TEXT NOT NULL,
    "sellerBic" TEXT NOT NULL,
    "sellerEmail" TEXT,
    "sellerPhone" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "buyerPostalCode" TEXT NOT NULL,
    "buyerCity" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "buyerVatId" TEXT NOT NULL,
    "woltInvoiceNumber" TEXT,
    "woltInvoiceDate" DATETIME,
    "clientId" INTEGER,
    "buyerClientId" INTEGER,
    "totalExVat" REAL NOT NULL,
    "totalVat" REAL NOT NULL,
    "totalIncVat" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_buyerClientId_fkey" FOREIGN KEY ("buyerClientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("buyerAddress", "buyerBusinessId", "buyerCity", "buyerName", "buyerPostalCode", "buyerVatId", "clientId", "createdAt", "dueDate", "id", "invoiceDate", "invoiceNumber", "notes", "paymentTerms", "periodEnd", "periodStart", "sellerAddress", "sellerBic", "sellerBusinessId", "sellerCity", "sellerEmail", "sellerIban", "sellerName", "sellerPhone", "sellerPostalCode", "sellerVatId", "totalExVat", "totalIncVat", "totalVat", "updatedAt", "woltInvoiceDate", "woltInvoiceNumber") SELECT "buyerAddress", "buyerBusinessId", "buyerCity", "buyerName", "buyerPostalCode", "buyerVatId", "clientId", "createdAt", "dueDate", "id", "invoiceDate", "invoiceNumber", "notes", "paymentTerms", "periodEnd", "periodStart", "sellerAddress", "sellerBic", "sellerBusinessId", "sellerCity", "sellerEmail", "sellerIban", "sellerName", "sellerPhone", "sellerPostalCode", "sellerVatId", "totalExVat", "totalIncVat", "totalVat", "updatedAt", "woltInvoiceDate", "woltInvoiceNumber" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
