// 一次性素材导入管线：把 D:\aaa\uuu\个人档案 的作品转换/拷贝进 public/assets
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/aaa/uuu/locker-folio'
const SRC = 'D:/aaa/uuu/个人档案'
const PUBLIC = path.join(ROOT, 'public', 'assets')

const P = {
  xmas_market: '92669db35ca2da9211b91343243044fe.png',
  skunk: '87eb08f19364fd188482f88abfce7065.png',
  tiny_joy: '885235313662b98d33bc1fa527b59097.png',
  flower_guide: 'ccdfdbbc575f05c8b44caef4eee78e56.png',
  jujube: '4c9e74142d824843831debc161576078.png',
  tomato_egg: '84a0be2b36c84f2542ef3927be536add.png',
  big_blue: 'a610f5a7102d894b2b13b2d5d0e79a0d.jpg',
  mid_autumn: 'b1ca6f83be421caa2e7228d177149733.png',
  forest: 'ca5e4ef33ce8cfaa34c9c78e053125ca.png',
  peach_jasmine: 'ec62769e88915db3626921a9a29b6327.jpg',
}

// 摄影顺序：文件名 -> slug
const PHOTO_ORDER = [
  '081646c541806560791533c1c76ab9f8', '2734e83509fe51846e9a5d197a1ee862',
  '2d0589bd7aa0fab0162c8570de49f51d', '090362a8321dfeb23c13fb087e1f3bdd',
  'c87e665b4f3c284de4da8ac379767d90', 'd0f7a78ce8fd0335ddc3065c6f2c49b4',
  'bf1fabe66437f8d5342d182bf053b8df', 'cd8e61d5ac08f13d105d540caa9e2c10',
  '7f185220638e0d21ba4611a01490de41', '8303b999d0396474a929d1d60e0ea59c',
  '83ee1af0260aaea6713aedb7cae6f6b8', '8d0ab5fc54c4434e9d7382ef4ecadc93',
  'be7d870798a99ee339d24657cbe60a69', 'b4428c550828f0bff7df485ac2397f97',
  'b67d367fc2dfdae0d1d24d1b6a86e243', 'cb1ca321a0314ddc51e8d7229d17f635',
  'cd75f36e395de1a990112443500b0c8d', '32255797dd7bf3576d572ede8b5feba7',
  '856290d36c01c574374848551ddabd3c', '38ba614a8f635c3f38ef3e072f11924e',
  '48122b5eaa2133e12a1e8aefc63b2975', '484f0de695818899256446beb7ae6fe1',
  '59af09a44f5434464ca3cde9616af035', '9145187c6f22fb8019ea299d54bf1cd8',
  'd9f1a40a34e99d62d1d7246cd8ba54fe', 'e8dfda0d6dc56902d0e0d75dc210dae8',
  '98dd37df84093bf1e942d93af7f02732', 'a03feadde5c446c5db468963c7d8c65e',
  'f3f42fa160ad6ab461321b312a3af758', 'fad4e277b4ef67e955a4e3eb63dfd34d',
  'fd6739492281e5a64243572d64ec06e7', '937c50ef83d765cab84ace0145b15844',
  '89b94735f8b94c06446db66ee130694c', '8e0fa18c5c73dceb18f5c9554fc588d4',
  'a489c3a04318a5065cc373e60bb370bf', 'a5f579c13a55142b78f103b78885cc55',
  'accf6c8be78569ece654e17be7089922', 'b044daa77f1eb1261595422b3ca28c5b',
  'c750b5c1f72ac1e15d72d3e916fb3d2b', 'f6508cc7f60c24758071459177a95fda',
  'f6f82ee8584c5a6c6bbf10f1a9f1b10c', 'f96a5c40d787205a7fb6368c37870899',
]

const STICKERS = {
  bunny: '5d3fe1cf4a6c34f2f38dd6e4737b0f09.png',
  puppy: 'c84ded0e8f1b7e56762e6998c5a07427.png',
  clover: 'c30af186092b1a08e12422f04dd348d0.png',
  girl: '3b3e650dee298bba40e87d50f68d294e.png',
  shark: '15c3ef3cb989bef621eb25020b44e19d.png',
  seal: '8fb46ab817183d000c7e1dddab6d628a.png',
}

const VIDEOS = {
  jungle: '0.mp4',
  village: '1.mp4',
  graduation: '2.mp4',
}

/** 生成 webp 原图 + 变体 */
async function gen(base, srcFile, fullW, widths) {
  const src = path.join(SRC, srcFile)
  const outBase = path.join(PUBLIC, base)
  fs.mkdirSync(outBase, { recursive: true })
  const name = path.basename(base)
  // 原图
  await sharp(src)
    .rotate()
    .resize({ width: fullW, withoutEnlargement: false })
    .webp({ quality: 82, effort: 6 })
    .toFile(path.join(outBase, `${name}.webp`))
  // 变体
  for (const w of widths) {
    await sharp(src)
      .rotate()
      .resize({ width: w, withoutEnlargement: false })
      .webp({ quality: 80, effort: 6 })
      .toFile(path.join(outBase, `${name}-${w}.webp`))
  }
  console.log('OK', base, 'full=' + fullW, 'variants=' + widths.join(','))
}

async function main() {
  // 1. 海报（平面设计 → posters）
  for (const [slug, file] of Object.entries(P)) {
    await gen(path.join('posters', slug), path.join('平面设计', file), 1000, [400, 700])
  }
  // 2. 照片（摄影 → photo），原图 900w + 300/600
  for (const [i, file] of PHOTO_ORDER.entries()) {
    const slug = 'p' + String(i + 1).padStart(2, '0')
    await gen(path.join('photo', slug), path.join('摄影作品', file + '.jpg'), 900, [300, 600])
  }
  // 3. 视频封面（.frames 抽帧 → cover），原图 960w + 480/640
  for (const [slug, frame] of Object.entries({ jungle: 'v1.webp', village: 'v2.webp', graduation: 'v3.webp' })) {
    const src = path.join(SRC, '.frames', frame)
    const outBase = path.join(PUBLIC, 'cover')
    fs.mkdirSync(outBase, { recursive: true })
    await sharp(src).rotate().resize({ width: 960, withoutEnlargement: false }).webp({ quality: 82, effort: 6 })
      .toFile(path.join(outBase, `${slug}.webp`))
    for (const w of [480, 640]) {
      await sharp(src).rotate().resize({ width: w, withoutEnlargement: false }).webp({ quality: 80, effort: 6 })
        .toFile(path.join(outBase, `${slug}-${w}.webp`))
    }
    console.log('OK cover', slug)
  }
  // 4. 贴纸（贴纸 → stickers）800w 单图
  for (const [slug, file] of Object.entries(STICKERS)) {
    await gen(path.join('stickers', slug), path.join('贴纸', file), 800, [])
  }
  // 5. 视频本体（影像 → video）
  const outVideo = path.join(PUBLIC, 'video')
  fs.mkdirSync(outVideo, { recursive: true })
  for (const [slug, file] of Object.entries(VIDEOS)) {
    fs.copyFileSync(path.join(SRC, '影像作品', file), path.join(outVideo, `${slug}.mp4`))
    console.log('OK video', slug + '.mp4')
  }
  console.log('DONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
