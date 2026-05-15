# Wolt Substitute Invoice Tool

A bookkeeping tool for Finnish substitute workers (Wolt couriers) and their bookkeeper.

## Key Features

### Substitute Worker Invoices (`/`)
- Generate invoices from substitute worker → account holder (Wolt)
- Invoice number auto-format: `BB-{workerID}-{YYYYMM}-{1/2}`
- Line items: Wolt fees, tips, other — with configurable share % (default 75%) and VAT rate
- Select worker and account holder from saved clients, or fill manually
- Live HTML preview + PDF download on save
- Bilingual labels (Finnish / English) on all invoices

### Bookkeeper Invoices (`/bookkeeper`)
- Create invoices **from yourself (bookkeeper)** to clients
- Default service: bookkeeping & tax filing, €25.00 + 25.5% VAT = €31.38
- Your details (name, Business ID, VAT ID, IBAN, BIC) saved in browser — fill once, reuse always
- Select any saved client from the database as the bill-to party
- Invoice number auto-format: `BK-{YYYYMM}-{seq}`
- Live preview + PDF download
- History table with all past bookkeeper invoices

### Invoice History (`/invoices`)
- Invoices grouped by substitute worker
- **VAT filing summary**: annual totals + quarterly breakdown (Q1–Q4) — ready for OmaVero
- Per-worker totals: turnover excl. VAT, VAT collected, total incl. VAT
- Expand any worker to see their individual invoices; expand an invoice to see line items
- Download PDF or delete any invoice

### Client Database (`/clients`)
- Store substitute workers and account holders with full details
- Fields: name, Business ID (Y-tunnus), VAT ID, address, IBAN, BIC, email, phone, notes
- Client IDs start at 101 and auto-increment
- Deleting a client safely unlinks their invoices (no data loss)

## Tech Stack
- **Next.js 14** (App Router, Server Actions)
- **Prisma 5 + SQLite** (`prisma/dev.db`)
- **@react-pdf/renderer** — server-side PDF generation
- **Tailwind CSS 3**
- **TypeScript** (strict mode)

## Running Locally
```bash
npm install
npx prisma migrate dev
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).
