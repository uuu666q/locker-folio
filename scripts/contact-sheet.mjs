// 临时工具：把图片拼成带文件名的联系表，便于批量审阅
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const srcDir = process.argv[2]
const outDir = process.argv[3] ?? path.join(srcDir, '.sheets')
const cols = Number(process.argv[4] ?? 4)
const thumb = Number(process.argv[5] ?? 340)

fs.mkdirSync(outDir, { recursive: true })

const files = fs.readdirSync(srcDir)
  .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .sort()

const cellW = thumb
const cellH = Math.round(thumb * 4 / 3)
const pad = 14
const labelH = 22
const perSheet = cols * 6

async function main() {
  const infos = []
  for (const f of files) {
    const meta = await sharp(path.join(srcDir, f)).rotate().metadata()
    infos.push({ f, w: meta.width, h: meta.height })
  }

  const sheetCount = Math.ceil(infos.length / perSheet)
  for (let s = 0; s < sheetCount; s++) {
    const slice = infos.slice(s * perSheet, (s + 1) * perSheet)
    const rows = Math.ceil(slice.length / cols)
    const W = cols * (cellW + pad) + pad
    const H = rows * (cellH + labelH + pad) + pad
    const composite = []
    for (let i = 0; i < slice.length; i++) {
      const { f, w, h } = slice[i]
      const scale = Math.min(cellW / w, cellH / h)
      const tw = Math.max(1, Math.round(w * scale))
      const th = Math.max(1, Math.round(h * scale))
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * (cellW + pad)
      const y = pad + row * (cellH + labelH + pad)
      const buf = await sharp(path.join(srcDir, f)).rotate().resize(tw, th).jpeg({ quality: 72 }).toBuffer()
      composite.push({
        input: buf,
        left: Math.round(x + (cellW - tw) / 2),
        top: Math.round(y + (cellH - th) / 2),
      })
    }
    // 用 SVG 做文字标签
    let svg = `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#111"/></svg>`
    // 逐格加标签
    const parts = [`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#111111"/>`]
    for (let i = 0; i < slice.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * (cellW + pad)
      const y = pad + row * (cellH + labelH + pad) + cellH + 3
      const name = slice[i].f.replace(/\.(jpg|jpeg|png|webp)$/i, '')
      parts.push(`<text x="${x}" y="${y + 14}" font-family="Consolas,monospace" font-size="15" fill="#e8e8e8">${name}</text>`)
    }
    parts.push('</svg>')
    const bg = await sharp(Buffer.from(parts.join(''))).png().toBuffer()
    composite.unshift({ input: bg, left: 0, top: 0 })
    const out = path.join(outDir, `sheet-${String(s + 1).padStart(2, '0')}.jpg`)
    await sharp({ create: { width: W, height: H, channels: 3, background: '#111111' } })
      .composite(composite)
      .jpeg({ quality: 80 })
      .toFile(out)
    console.log('SHEET', out, `${slice.length} images, ${W}x${H}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
