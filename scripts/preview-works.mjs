// 临时工具：为我的审阅生成小尺寸预览图（不进入最终交付）
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const srcDir = process.argv[2]
const outDir = process.argv[3] ?? path.join(srcDir, '.preview')

fs.mkdirSync(outDir, { recursive: true })

for (const f of fs.readdirSync(srcDir)) {
  const src = path.join(srcDir, f)
  if (!fs.statSync(src).isFile()) continue
  const ext = path.extname(f).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue
  const out = path.join(outDir, path.basename(f, ext) + '.jpg')
  try {
    await sharp(src)
      .rotate() // 按 EXIF 摆正
      .resize({ width: 500, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(out)
    console.log('OK', f, '->', out)
  } catch (e) {
    console.log('FAIL', f, e.message)
  }
}
