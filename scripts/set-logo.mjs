import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const LOGO = 'logo1.jpeg'
const W = 1600
const H = 639

const raw = readFileSync(LOGO)
const b64 = raw.toString('base64')
const dataUri = `data:image/jpeg;base64,${b64}`

const pngLogo = await sharp(raw, { density: 300 })
  .resize(W, H, { fit: 'fill' })
  .png()
  .toBuffer()

async function tileIcon(pngLogo, size, pct, file) {
  const cw = Math.round((size * pct) / 100)
  const ch = Math.round(cw * (H / W))
  const src = await sharp(pngLogo).resize(cw, ch, { fit: 'fill' }).png().toBuffer()
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
  const merged = await canvas
    .composite([
      { input: src, left: Math.round((size - cw) / 2), top: Math.round((size - ch) / 2) },
    ])
    .png()
    .toBuffer()
  writeFileSync(file, merged)
  console.log('ok', file, size, `logo ${pct}%`)
}

function ico(pngBuf, icoPath) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(48, 6)
  header.writeUInt8(48, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuf.length, 14)
  header.writeUInt32LE(22, 18)
  writeFileSync(icoPath, Buffer.concat([header, pngBuf]))
  console.log('ok ico', icoPath)
}

const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><image href="${dataUri}" width="${W}" height="${H}"/></svg>\n`
writeFileSync('public/favicon.svg', svgWrapper)
writeFileSync('src/assets/logo.svg', svgWrapper)
console.log('ok favicon.svg + src/assets/logo.svg (wide wrapper)')

await tileIcon(pngLogo, 512, 92, 'src/assets/logo.png')
await tileIcon(pngLogo, 64, 92, 'public/pwa-64x64.png')
await tileIcon(pngLogo, 192, 92, 'public/pwa-192x192.png')
await tileIcon(pngLogo, 512, 92, 'public/pwa-512x512.png')
await tileIcon(pngLogo, 180, 92, 'public/apple-touch-icon-180x180.png')
await tileIcon(pngLogo, 512, 70, 'public/maskable-icon-512x512.png')

const ico48 = await sharp(pngLogo).resize(44, Math.round(44 * (H / W)), { fit: 'fill' }).png().toBuffer()
const canvas48 = sharp({
  create: { width: 48, height: 48, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
const icoPng = await canvas48
  .composite([{ input: ico48, left: 2, top: Math.round((48 - 44 * (H / W)) / 2) }])
  .png()
  .toBuffer()
ico(icoPng, 'public/favicon.ico')

let html = readFileSync('index.html', 'utf8')
if (html.includes('{{LOGO_DATA_URI}}')) {
  html = html.replace('{{LOGO_DATA_URI}}', dataUri)
  writeFileSync('index.html', html)
  console.log('ok index.html splash logo embedded', Math.round(b64.length / 1024), 'KB')
} else {
  console.log('skip index.html (no placeholder)')
}
console.log('done')