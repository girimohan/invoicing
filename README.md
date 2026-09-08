# Barmo Bookkeeping

A desktop bookkeeping tool for Finnish sole traders doing platform work (Wolt
and similar), and for the bookkeeper who files on their behalf. Tracks income,
expenses, VAT and income tax reference figures per client, and produces the
figures needed for OmaVero.

Originally built around invoicing between substitute couriers and account
holders. Every client is now a platform-account owner in their own right, so
that workflow has moved to **Tools → Legacy** and the app leads with the
bookkeeping cycle instead.

## Screens

### Dashboard (`/`)
The daily working view. One row per client for the current VAT period:
turnover, output VAT, input VAT and net VAT payable, plus the filing deadline
countdown (*arvonlisäveroilmoitus* is due on the 12th of the second month after
the period ends). Flags clients with no entries yet and clients not yet billed
for your bookkeeping fee. Switch period or filing frequency at the top; click a
client to open their books.

### Client Books (`/books`)
The core of the app, per client and per year:
- **Income** — Wolt pay periods (ex-VAT amount, tips at 0% VAT, Wolt invoice ref)
- **Expenses** — categorised business costs with VAT
- **VAT** — monthly breakdown grouped into quarterly / half-year / annual filing
  periods, each expandable down to the individual contributing records, with a
  PDF report per period
- **Tax Return** — *elinkeinotoiminnan veroilmoitus* reference figures, including
  automatic declining-balance depreciation (*poistot*, EVL 30§) on capital assets
- **Vehicle** — mileage and trip log (*ajopäiväkirja*)

### Clients (`/clients`)
Client records — name, Y-tunnus, VAT ID, address, IBAN/BIC, contact details.
Client IDs start at 101. Deleting a client unlinks their invoices rather than
destroying them.

### Bookkeeper (`/bookkeeper`, `/my-vat`)
Issue your own bookkeeping-fee invoices to clients, and track your own VAT
position for OmaVero across both bookkeeping fees and your own gig work.

### Tools (`/tools`)
YEL pension calculator, plus the legacy substitute-worker invoice generator and
its invoice history — kept fully working so historical invoices stay editable
and correctly reported.

## VAT allocation rule
Every income record is assigned to a VAT period by its **service period**
(`periodEnd` / `periodStart`), never by invoice or issue date. A job done
15–30 June but invoiced in July belongs to Q2. This holds for client invoices,
bookkeeper invoices and income periods alike.

## Tech Stack
- **Next.js 14** (App Router, Server Actions)
- **Prisma 5 + SQLite**
- **Electron 42** + electron-builder (Windows NSIS installer)
- **@react-pdf/renderer** — server-side PDF generation
- **Tailwind CSS 3**, **TypeScript** (strict)

## Running Locally
```bash
npm install
npx prisma migrate deploy
npm run electron:dev     # Next.js dev server + Electron together
npm test                 # Jest unit tests
```

See [DEVELOPER_NOTES.md](DEVELOPER_NOTES.md) for database handling, migrations
and the build/release workflow — **read the database protection rules before
running any Prisma command.**
