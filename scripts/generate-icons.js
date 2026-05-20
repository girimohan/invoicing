/**
 * Generates public/icon.png (512x512) and public/icon.ico (multi-size)
 * from public/icon.svg.
 *
 * Usage: node scripts/generate-icons.js
 */

const sharp = require("sharp")
const path = require("path")
const fs = require("fs")

const PUBLIC = path.join(__dirname, "..", "public")
const svgPath = path.join(PUBLIC, "icon.svg")
const pngPath = path.join(PUBLIC, "icon.png")
const icoPath = path.join(PUBLIC, "icon.ico")

/**
 * Builds a valid multi-size ICO by embedding PNG data directly.
 * "PNG-compressed ICO" is supported on Windows Vista and later.
 */
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dirEntries = []
  let offset = 6 + count * 16

  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(16)
    const sz = sizes[i]
    entry.writeUInt8(sz >= 256 ? 0 : sz, 0)
    entry.writeUInt8(sz >= 256 ? 0 : sz, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(pngBuffers[i].length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += pngBuffers[i].length
    dirEntries.push(entry)
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers])
}

async function main() {
  const svgBuf = fs.readFileSync(svgPath)

  await sharp(svgBuf).resize(512, 512).png().toFile(pngPath)
  console.log("?  public/icon.png  (512�512)")

  const ICO_SIZES = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((s) => sharp(svgBuf).resize(s, s).png().toBuffer())
  )

  const icoBuf = buildIco(pngBuffers, ICO_SIZES)
  fs.writeFileSync(icoPath, icoBuf)
  console.log("?  public/icon.ico  (16/32/48/64/128/256 px)")
  console.log("\nDone � icons are in public/")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
