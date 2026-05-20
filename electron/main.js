const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const { existsSync, copyFileSync, mkdirSync } = require('fs')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development'
const PORT = 3000

let nextProcess = null

// ── First-run: copy seed DB to userData if no database exists yet ─────────────
function initDatabase() {
  const userDataDir = app.getPath('userData')
  const dbDest = path.join(userDataDir, 'dev.db')

  if (!existsSync(dbDest)) {
    // seed.db is an empty SQLite DB with the correct schema, bundled in resources
    const seedDb = path.join(process.resourcesPath, 'prisma', 'seed.db')
    if (existsSync(seedDb)) {
      mkdirSync(userDataDir, { recursive: true })
      copyFileSync(seedDb, dbDest)
      console.log('Database initialised from seed.')
    } else {
      console.warn('seed.db not found — database will be created on first query.')
    }
  }

  return dbDest
}

// ── Wait until the Next.js HTTP server is accepting connections ──────────────
function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get(`http://localhost:${PORT}`, () => resolve())
        .on('error', () => {
          if (++attempts >= retries) return reject(new Error('Next.js server did not start in time'))
          setTimeout(check, 500)
        })
    }
    check()
  })
}

// ── Start the bundled Next.js standalone server (production only) ────────────
function startNextServer() {
  if (isDev) return Promise.resolve()

  const dbPath = initDatabase()

  // The standalone directory is unpacked by electron-builder (asar: false)
  const standaloneDir = path.join(process.resourcesPath, 'app', '.next', 'standalone')
  const serverScript = path.join(standaloneDir, 'server.js')

  nextProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,  // server.js resolves .next/static and public relative to cwd
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      DATABASE_URL: `file:${dbPath}`,
    },
    stdio: 'inherit',
  })

  nextProcess.on('error', (err) => console.error('Next.js process error:', err))
  return waitForServer()
}

// ── Create the browser window ─────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Wolt Invoice Tool',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  // Open external links in the system browser, not inside Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(`http://localhost:${PORT}`)
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
