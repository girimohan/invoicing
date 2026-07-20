const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { existsSync, copyFileSync, mkdirSync, statSync } = require('fs')
const http = require('http')
const net = require('net')

// ── Lock userData to the product name folder, regardless of package.json name ─
// Without this, Electron uses package.json "name" ("wolt-substitute-invoice")
// as the userData folder, so each build might use a different path.
app.setPath('userData', path.join(app.getPath('appData'), 'Barmo Bookkeeping'))

const isDev = process.env.NODE_ENV === 'development'
const DEV_PORT = 3000

let nextProcess = null
let activePort = DEV_PORT

// ── Single-instance lock ──────────────────────────────────────────────────────
// Without this, clicking the exe again while it's already running would open a
// second Electron instance. We instead focus the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}
app.on('second-instance', () => {
  const existing = BrowserWindow.getAllWindows()[0]
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  }
})

// ── First-run: copy seed DB to userData if no database exists yet ─────────────
function initDatabase() {
  const userDataDir = app.getPath('userData')
  const dbDest = path.join(userDataDir, 'dev.db')

  // Copy seed DB if the file doesn't exist OR is empty (0 bytes from a failed previous init)
  const needsSeed = !existsSync(dbDest) || statSync(dbDest).size === 0
  if (needsSeed) {
    const seedDb = path.join(process.resourcesPath, 'prisma', 'seed.db')
    if (existsSync(seedDb)) {
      mkdirSync(userDataDir, { recursive: true })
      copyFileSync(seedDb, dbDest)
      console.log('Database initialised from seed.')
    } else {
      console.warn('seed.db not found — DB will be empty on first query.')
    }
  }

  return dbDest
}

// ── Bring an existing user's database up to date ─────────────────────────────
// initDatabase() only SEEDS a fresh DB. Users upgrading from an older version
// keep their existing dev.db, which has an older schema. Without this step,
// new code querying new tables/columns throws "table does not exist" (P2021)
// and Next.js surfaces it as an opaque "Server Components render error".
// `prisma migrate deploy` is idempotent — a no-op when already up to date —
// and applies only the missing migrations to the user's real data in place.
function runMigrations(dbPath) {
  if (isDev) return // dev uses `npm run db:push` manually

  const cliRoot    = path.join(process.resourcesPath, 'prisma-cli', 'node_modules')
  const prismaCli  = path.join(cliRoot, 'prisma', 'build', 'index.js')
  const schemaPath = path.join(process.resourcesPath, 'prisma', 'schema.prisma')
  const engineName =
    process.platform === 'win32'  ? 'schema-engine-windows.exe' :
    process.platform === 'darwin' ? 'schema-engine-darwin' :
                                    'schema-engine-debian-openssl-3.0.x'
  const schemaEngine = path.join(cliRoot, '@prisma', 'engines', engineName)

  if (!existsSync(prismaCli) || !existsSync(schemaPath)) {
    console.warn('Prisma CLI or schema not bundled — skipping migrations.')
    return
  }

  const env = {
    ...process.env,
    // Run the Electron binary as plain Node so it executes the prisma CLI.
    ELECTRON_RUN_AS_NODE: '1',
    DATABASE_URL: `file:${dbPath}`,
    CHECKPOINT_DISABLE: '1', // no telemetry / update checks
  }
  // Point Prisma at the bundled schema engine so it never tries to download one.
  if (existsSync(schemaEngine)) env.PRISMA_SCHEMA_ENGINE_BINARY = schemaEngine

  const result = spawnSync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
    { env, encoding: 'utf8' }
  )

  if (result.status === 0) {
    console.log('Database migrations up to date.')
  } else {
    console.error('Prisma migrate deploy failed:', result.stdout, result.stderr)
  }
}

// ── Find a free TCP port starting from `start` ───────────────────────────────
function getFreePort(start = 3847) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(start, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', () => {
      if (start < 4100) getFreePort(start + 1).then(resolve).catch(reject)
      else reject(new Error('No free port found in range 3847-4100'))
    })
  })
}

// ── Wait until the Next.js HTTP server is accepting connections ──────────────
function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get(`http://localhost:${port}`, () => resolve())
        .on('error', () => {
          if (++attempts >= retries) return reject(new Error('Next.js server did not start in time'))
          setTimeout(check, 500)
        })
    }
    check()
  })
}

// ── Start the bundled Next.js standalone server (production only) ────────────
async function startNextServer() {
  if (isDev) return

  const dbPath = initDatabase()
  runMigrations(dbPath)
  const port = await getFreePort(3847)
  activePort = port

  const standaloneDir = path.join(process.resourcesPath, 'app', '.next', 'standalone')
  const serverScript = path.join(standaloneDir, 'server.js')

  nextProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      // CRITICAL: tells the Electron binary to behave as plain Node.js.
      // Without this, spawning process.execPath would launch ANOTHER full
      // Electron window, which would spawn another server, which would open
      // another window — recursively producing hundreds of windows.
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      NODE_ENV: 'production',
      DATABASE_URL: `file:${dbPath}`,
    },
    stdio: 'inherit',
  })

  nextProcess.on('error', (err) => console.error('Next.js process error:', err))
  return waitForServer(port)
}

// ── Create the browser window ─────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Barmo Bookkeeping',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const loadUrl = isDev
    ? `http://localhost:${DEV_PORT}`
    : `http://localhost:${activePort}`

  win.loadURL(loadUrl)
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await startNextServer()
  createWindow()
})

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
