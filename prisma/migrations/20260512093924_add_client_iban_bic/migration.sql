-- CreateTable
CREATE TABLE "Invoice" (
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
    "totalExVat" REAL NOT NULL,
    "totalVat" REAL NOT NULL,
    "totalIncVat" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "displayId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ACCOUNT_HOLDER',
    "name" TEXT NOT NULL,
    "businessId" TEXT,
    "vatId" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "earnedAmount" REAL NOT NULL DEFAULT 0,
    "sharePercent" REAL NOT NULL DEFAULT 100,
    "vatRate" REAL NOT NULL,
    "amountExVat" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    CONSTRAINT "LineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Client_displayId_key" ON "Client"("displayId");
