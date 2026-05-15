-- CreateTable
CREATE TABLE "BookkeeperInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paymentTerms" TEXT NOT NULL DEFAULT '14 pv netto / 14 days net',
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

-- CreateIndex
CREATE UNIQUE INDEX "BookkeeperInvoice_invoiceNumber_key" ON "BookkeeperInvoice"("invoiceNumber");
