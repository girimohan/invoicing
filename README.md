# Barmo Bookkeeping

A desktop bookkeeping tool for Finnish sole traders doing platform work (Wolt
and similar), and for the bookkeeper who files on their behalf. Tracks income,
expenses, VAT and income tax reference figures per client, and produces the
figures needed for OmaVero.

Originally built around invoicing between substitute couriers and account
holders. Every client now runs their own platform account, so that workflow has
moved to **Tools** and the app leads with the bookkeeping cycle instead. The old
records stay fully reportable — nothing was removed.

## Screens

### Clients (`/`)
The home screen and the only client list. One row per client for the current
VAT period: their turnover, their net VAT, which months still have no entries,
and whether your service fee has been invoiced. Nothing is summed across
clients — they file separately, so a combined total would mean nothing.

From here you can add a client, edit one, add a monthly income entry from the
platform's self-billing invoice, or click through to their books. The VAT
deadline (*arvonlisäveroilmoitus*, due the 12th of the second month after the
period ends) is shown in the header, and called out when it is close or past.

### Books (`/books?client=`)
Opened by clicking a client. Per client and per year:
- **Income** — Wolt pay periods (ex-VAT amount, tips at 0% VAT, Wolt invoice ref)
- **Expenses** — categorised business costs with VAT
- **VAT** — monthly breakdown grouped into quarterly / half-year / annual filing
  periods, each expandable down to the individual contributing records, with a
  PDF report per period
- **Tax Return** — *elinkeinotoiminnan veroilmoitus* reference figures, including
  automatic declining-balance depreciation (*poistot*, EVL 30§) on capital assets
- **Vehicle** — mileage and trip log (*ajopäiväkirja*)

### Bookkeeper (`/bookkeeper`, `/my-vat`)
Issue your own bookkeeping-fee invoices to clients, and track your own VAT
position for OmaVero across both bookkeeping fees and your own gig work.

### Filing Guide (`/filing`)
Step-by-step OmaVero walkthrough for the VAT return and the annual business tax
return (Form 5), showing the selected client's own figures against each MyTax
field. Content is checked against vero.fi and each step links its source.

### Tools (`/tools`)
YEL calculator, plus the retired worker invoice generator and its invoice
history — kept working so past invoices stay editable and correctly reported.

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
