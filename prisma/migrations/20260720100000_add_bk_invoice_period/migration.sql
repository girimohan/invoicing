-- Add service period (periodStart/periodEnd) to BookkeeperInvoice.
-- Backfill existing rows to the calendar month of their issueDate.
-- Prisma stores SQLite DateTime columns as integer ms-since-epoch, so issueDate
-- must be converted via unixepoch before using SQLite's date functions, then
-- converted back to ms-since-epoch to match the column's storage format.
ALTER TABLE "BookkeeperInvoice" ADD COLUMN "periodStart" DATETIME;
ALTER TABLE "BookkeeperInvoice" ADD COLUMN "periodEnd" DATETIME;

UPDATE "BookkeeperInvoice"
SET periodStart = CAST(strftime('%s', datetime(issueDate / 1000, 'unixepoch', 'start of month')) AS INTEGER) * 1000,
    periodEnd   = CAST(strftime('%s', datetime(issueDate / 1000, 'unixepoch', 'start of month', '+1 month', '-1 day')) AS INTEGER) * 1000
WHERE periodStart IS NULL;
