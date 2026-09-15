/**
 * 作品图的响应式源。
 *
 * 原图宽 900–1000px，而各栏目真实显示宽度只有 200–530 CSS px。
 * `scripts/gen-image-variants.sh` 按 1x / 2x 生成了两档变体，这里统一拼 srcset，
 * 让浏览器按显示尺寸和 DPR 取最小的一张 —— 直接决定 RGBA 解码占用的内存。
 */

/** 各栏目原图的像素宽 */
const FULL_W = {
  photo: 900,
  posters: 1000,
  mag: 1049,
  cover: 960,
} as const

/** 与生成脚本保持一致的变体宽度 */
const VARIANTS: Record<keyof typeof FULL_W, number[]> = {
  photo: [300, 600],
  posters: [400, 700],
  mag: [420, 760],
  cover: [480, 640],
}

export type WorkAssetDir = keyof typeof FULL_W

/** 各栏目的 `sizes`：按实际 CSS 宽度书写，写错会让浏览器取过大的图 */
export const SIZES = {
  /**
   * 照片墙格子最大 448 宽，窄屏整面墙乘 k = 视口宽/1320，即 448/1320 = 33.94vw。
   * 必须保留 vw 项：写成裸 '448px' 的话，DPR3 手机会要 1344 设备像素，
   * 而变体只有 300/600/900，浏览器只能回落到 1400w 原图 —— 六张一起解码约 31MiB。
   */
  photo: 'min(34vw, 448px)',
  /** 海报卡 clamp(210px, 24vw, 330px) */
  posters: '(max-width: 875px) 210px, (min-width: 1375px) 330px, 24vw',
  /** 杂志单页 = min(70vh, 48vw, 660px) / 2 = min(35vh, 24vw, 330px)，窄屏 86vw / 2 */
  mag: '(max-width: 820px) 43vw, min(35vh, 24vw, 330px)',
  /** 视频封面 = 内容区（≤1210px，两侧留白）减去 36% 的文字列和间距，窄屏整行 */
  video: '(max-width: 780px) 92vw, (min-width: 1310px) 660px, 54vw',
  /** 网站轮播卡 clamp(280px, 40vw, 532px) */
  website: '(max-width: 700px) 280px, (min-width: 1330px) 532px, 40vw',
} as const

/** 返回可直接展开到 `<img>` 上的 src / srcSet */
export function workImage(dir: WorkAssetDir, name: string) {
  const base = `assets/${dir}/${name}`
  const widths = VARIANTS[dir]
  const srcSet = [
    ...widths.map((w) => `${base}-${w}.webp ${w}w`),
    `${base}.webp ${FULL_W[dir]}w`,
  ].join(', ')
  // 不支持 srcset 时退回最大的一档变体，而不是原图
  return { src: `${base}-${widths[widths.length - 1]}.webp`, srcSet }
}

/**
 * 关闭大型作品页时主动断开图片引用。
 *
 * React 卸载节点本身就会释放解码位图，但栏目里可能有正在飞行中的请求和
 * 尚未解码完的大图；先清空 src/srcset 能让浏览器立刻放弃它们，
 * 也顺手回收由本页创建的对象 URL。
 */
export function releaseImages(root: HTMLElement | null) {
  if (!root) return
  // 推到微任务里再动手：只有节点真的脱离文档才断引用，
  // 这样 StrictMode 开发期的“模拟卸载”不会把还在用的图清空。
  queueMicrotask(() => {
    if (root.isConnected) return
    for (const img of root.querySelectorAll('img')) {
      if (img.currentSrc.startsWith('blob:')) URL.revokeObjectURL(img.currentSrc)
      img.removeAttribute('srcset')
      img.removeAttribute('sizes')
      img.removeAttribute('src')
    }
  })
}
