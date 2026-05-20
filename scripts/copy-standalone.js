/**
 * Prepares the Next.js standalone output for Electron packaging.
 *
 * Next.js standalone mode produces .next/standalone/server.js but does NOT
 * automatically copy the static assets or public folder into it.
 * The server expects both to sit NEXT to server.js at runtime:
 *   .next/standalone/.next/static/   ← copy from .next/static/
 *   .next/standalone/public/         ← copy from public/
 *
 * Run this AFTER `next build` and BEFORE `electron-builder`.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const STANDALONE = path.join(ROOT, '.next', 'standalone')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

// Copy .next/static → .next/standalone/.next/static
copyDir(
  path.join(ROOT, '.next', 'static'),
  path.join(STANDALONE, '.next', 'static')
)
console.log('✔  .next/static  → .next/standalone/.next/static')

// Copy public → .next/standalone/public
copyDir(
  path.join(ROOT, 'public'),
  path.join(STANDALONE, 'public')
)
console.log('✔  public        → .next/standalone/public')

console.log('Standalone prep done.')
