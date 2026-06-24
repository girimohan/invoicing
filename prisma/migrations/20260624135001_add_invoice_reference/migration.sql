-- CreateTable
CREATE TABLE "InvoiceReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "baseNumber" TEXT NOT NULL,
    "checkDigit" TEXT NOT NULL,
    "formattedReference" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceReference_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReference_invoiceId_key" ON "InvoiceReference"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReference_formattedReference_key" ON "InvoiceReference"("formattedReference");
