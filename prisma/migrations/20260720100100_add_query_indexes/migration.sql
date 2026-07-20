-- Indexes for columns that list/VAT-summary queries filter or sort on.
-- Without these, deleting a record forces later full unindexed table scans
-- (via revalidatePath) that get slower as data grows.
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_periodEnd_idx" ON "Invoice"("periodEnd");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_buyerClientId_idx" ON "Invoice"("buyerClientId");
CREATE INDEX "Invoice_sellerBusinessId_idx" ON "Invoice"("sellerBusinessId");
CREATE INDEX "Invoice_buyerBusinessId_idx" ON "Invoice"("buyerBusinessId");

CREATE INDEX "BookkeeperInvoice_periodEnd_idx" ON "BookkeeperInvoice"("periodEnd");
CREATE INDEX "BookkeeperInvoice_issueDate_idx" ON "BookkeeperInvoice"("issueDate");
CREATE INDEX "BookkeeperInvoice_clientId_idx" ON "BookkeeperInvoice"("clientId");
CREATE INDEX "BookkeeperInvoice_bkBusinessId_idx" ON "BookkeeperInvoice"("bkBusinessId");

CREATE INDEX "OwnerIncomePeriod_periodStart_idx" ON "OwnerIncomePeriod"("periodStart");
CREATE INDEX "OwnerExpense_date_idx" ON "OwnerExpense"("date");
