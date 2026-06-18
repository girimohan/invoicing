# Barmo Bookkeeping — Developer Notes

## Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| UI | Next.js 14 App Router | `output: 'standalone'` for Electron packaging |
| Database | Prisma 5 + SQLite | Schema at `prisma/schema.prisma` |
| Desktop | Electron 42 | Entry: `electron/main.js` |
| Packaging | electron-builder 26 | NSIS + zip targets for Windows |

---

## Two Modes of Running

### Development (hot reload, no rebuild needed)
```powershell
npm run electron:dev
```
- Starts Next.js dev server on port 3000 AND Electron together
- Electron connects to `localhost:3000`
- Code changes appear instantly — **no rebuild required**
- Database used: `prisma/dev.db`

### Production (installed desktop app)
- Built via `npm run electron:build`
- Run the generated `dist-electron\Barmo Bookkeeping Setup 1.0.0.exe`
- Database used: `%APPDATA%\Barmo Bookkeeping\dev.db`

---

## Database — Critical Information

### Two separate database files

| Mode | File |
|---|---|
| Dev mode | `C:\Users\mohan\Desktop\invoicing\prisma\dev.db` |
| Installed app | `%APPDATA%\Barmo Bookkeeping\dev.db` |

They are **independent**. Data entered in one does not appear in the other.

### Syncing dev data → installed app
Close the installed app first, then:
```powershell
Copy-Item "C:\Users\mohan\Desktop\invoicing\prisma\dev.db" "$env:APPDATA\Barmo Bookkeeping\dev.db" -Force
```

### Database protection rules — READ THESE

**NEVER run these against `prisma/dev.db` unless you intend to wipe all data:**
```powershell
npx prisma db push --force-reset   # ⚠ DELETES ALL DATA
npx prisma migrate dev             # ⚠ May reset data in dev mode
```

**Safe commands:**
```powershell
npx prisma migrate deploy          # Apply migrations without data loss
npx prisma studio                  # Browse/edit data visually (localhost:5555)
npx prisma generate                # Regenerate Prisma Client after schema change
```

### Backing up production data
The production database lives at `%APPDATA%\Barmo Bookkeeping\dev.db`.
Back it up by simply copying it somewhere safe:
```powershell
Copy-Item "$env:APPDATA\Barmo Bookkeeping\dev.db" "C:\Backups\barmo-$(Get-Date -Format 'yyyyMMdd').db"
```

### First-run database initialisation (how it works)
On first launch, `electron/main.js` copies `resources/prisma/seed.db` to `%APPDATA%\Barmo Bookkeeping\dev.db`.
It only does this if the file is **missing or 0 bytes** — so existing data is never overwritten on updates.

`seed.db` = schema-only SQLite file (all tables, no rows). It is committed to git and bundled in the installer via `extraResources` in `package.json`.

> **If you change the schema**, you must regenerate `seed.db` after running migrations:
> ```powershell
> Copy-Item "prisma\dev.db" "prisma\seed.db"
> npx prisma migrate deploy --schema prisma/schema.prisma
> ```
> Then commit the new `seed.db`.

---

## Adding a Schema Migration

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name describe_your_change` (uses dev.db)
3. Verify the app works in dev mode
4. Update `seed.db` with the new schema (see above)
5. Rebuild: `npm run electron:build`
6. The new installer will apply migrations to new installs automatically (via seed.db)
7. **Existing installs**: the production `dev.db` at `%APPDATA%\Barmo Bookkeeping\` still has the old schema — you'll need to run `prisma migrate deploy` against it, or ship a migration script

---

## Build & Release Workflow

```powershell
# 1. Make code changes, test with:
npm run electron:dev

# 2. When ready to release, build the installer:
npm run electron:build
# Equivalent to:
# next build && node scripts/copy-standalone.js && electron-builder --win

# 3. Output is at:
dist-electron\Barmo Bookkeeping Setup 1.0.0.exe
dist-electron\Barmo Bookkeeping-1.0.0-win.zip
```

### Updating the already-installed production app after schema changes

When you add a new Prisma migration, the production database at
`%APPDATA%\Barmo Bookkeeping\dev.db` still has the old schema.

**Option A — Manual migration (no data loss, recommended)**
```powershell
# Close the installed Electron app first!
# Set DATABASE_URL to point at the production DB
$env:DATABASE_URL = "file:$env:APPDATA\Barmo Bookkeeping\dev.db"
npx prisma migrate deploy
```

**Option B — Overwrite with dev.db (loses production data)**
```powershell
# Close the installed Electron app first!
Copy-Item "prisma\dev.db" "$env:APPDATA\Barmo Bookkeeping\dev.db" -Force
```

**Option C — Fresh install (new machine or after uninstall)**
The installer uses `prisma/seed.db` which always has the latest schema.
Just run the new installer — no manual steps needed.

### Important build notes
- All pages that fetch from the database **must** have `export const dynamic = 'force-dynamic'` — otherwise Next.js bakes in empty data at build time and the installed app shows nothing
- Do NOT run the installer while the app is open
- The build uses `CSC_IDENTITY_AUTO_DISCOVERY=false` (no code signing) — already handled in the `electron:build` script

---

## Key Files

| File | Purpose |
|---|---|
| `electron/main.js` | Electron entry — window, server lifecycle, DB init |
| `prisma/schema.prisma` | Database schema |
| `prisma/dev.db` | Dev mode database |
| `prisma/seed.db` | Schema-only DB bundled with installer for first-run |
| `scripts/copy-standalone.js` | Copies Next.js build artifacts for Electron packaging |
| `src/components/Sidebar.tsx` | Left nav sidebar (replaces old top navbar) |
| `src/actions/` | All Prisma server actions (data fetching/mutation) |

---

## Electron Configuration Notes

- `package.json` has `name: "wolt-substitute-invoice"` but `productName: "Barmo Bookkeeping"` — these deliberately differ. **Do not rely on `app.getName()` for paths** — `main.js` explicitly sets userData:
  ```js
  app.setPath('userData', path.join(app.getPath('appData'), 'Barmo Bookkeeping'))
  ```
  If you ever remove this line, the app will use `%APPDATA%\wolt-substitute-invoice\` and lose access to the production database.

- The production server starts on a **dynamic port** (3847–4100) to avoid conflict with `npm run dev` running on 3000.

- `asar: false` is set in `package.json` build config — Prisma native binaries require this (they can't be read from an asar archive).
