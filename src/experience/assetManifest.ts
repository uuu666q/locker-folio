/* ============================================================================
 * 首屏资源清单 AssetManifest
 *
 * 这里是全站资源的**唯一事实来源**：
 *   1. 每项资源记录 id / url / 类型 / 分组 / 是否首屏阻塞 / 是否 preload /
 *      预期体积 / 解码方式 / fallback / 授权来源 / 版本哈希。
 *   2. Loader 只统计本清单中的真实事件（请求完成、decode() 完成），
 *      不再使用固定计时的假进度。
 *   3. index.html 里的 <link rel="preload"> 必须与 PRELOAD_ASSETS 一一对应，
 *      开发模式下 auditPreloadLinks() 会校验两边是否漂移。
 *
 * 约定：
 *   - version 是文件内容 sha256 前 8 位，**不拼进 URL**。
 *     拼进 URL 会和 <img src="/assets/..."> 产生两次不同缓存键的请求。
 *     换图后请用下面的命令重新生成：
 *       shasum -a 256 public/assets/<path> | cut -c1-8
 *   - bytes 是磁盘上的真实传输体积，Loader 用它做加权进度，
 *     所以换图后 bytes 也要同步更新（stat -f%z）。
 * ========================================================================== */

import { useSyncExternalStore } from 'react'

/* ── 类型 ─────────────────────────────────────────────────── */

export type AssetKind = 'image' | 'font'

export type AssetGroup =
  | 'hero.prop' // 柜内立体物件：首屏阻塞
  | 'hero.decal' // 柜门贴纸：首屏阻塞，但缺失可降级
  | 'type.display' // 网页字体阶段
  | 'work.poster'
  | 'work.photo'
  | 'work.cover'
  | 'work.magazine'

/** 资源失败后的处置方式 */
export type FailPolicy =
  /** 冒泡到 Loader 的错误态，提供重试；不阻止最终放行 */
  | 'error'
  /** 静默降级，只写开发期日志 */
  | 'degrade'

/**
 * 响应式派生图。由 scripts/gen-image-variants.sh 生成，
 * 运行时由 src/components/work/imageSources.ts 的 workImage() 拼成 srcset，
 * 浏览器按显示尺寸和 DPR 只取其中一张 —— 所以变体是同一份资源的不同档位，
 * 不是彼此独立的资源，登记为 entry 的子项而不是并列条目。
 */
export type AssetVariant = {
  /** 像素宽，对应 srcset 的 <w> 描述符 */
  width: number
  url: string
  bytes: number
  version: string
}

export type AssetEntry = {
  /** 稳定 ID，供状态机/热点引用 */
  id: string
  /** 站点根绝对路径，必须与 DOM 中 <img src> 完全一致 */
  url: string
  kind: AssetKind
  group: AssetGroup
  /** 首屏阻塞：Loader 必须等它 ready 才允许走到 100% */
  blocking: boolean
  /** 是否写进 index.html 的 <link rel="preload"> */
  preload: boolean
  /** 预期传输体积（字节），用于加权进度 */
  bytes: number
  /** 解码方式：图片走 HTMLImageElement.decode()，字体走 document.fonts.ready */
  decode: 'img-decode' | 'font-ready'
  /** 失败降级目标；null 表示没有备用资源 */
  fallback: string | null
  onFail: FailPolicy
  /** 单项超时上限（毫秒） */
  timeoutMs: number
  /** 内容授权来源。TODO：原始素材授权尚未确认 */
  license: string
  /** 内容哈希前 8 位 */
  version: string
  /** 响应式派生档位；首屏物件图没有变体，为空数组 */
  variants: readonly AssetVariant[]
}

const DEFAULT_TIMEOUT = 9_000
const LICENSE_TODO = 'unverified/待确认'

/** Hero 直接采样的实体表面纹理：首屏必须全部可用于渲染 */
function prop(
  id: string,
  url: string,
  bytes: number,
  version: string,
  preload = false,
): AssetEntry {
  return {
    id,
    url,
    kind: 'image',
    group: 'hero.prop',
    blocking: true,
    preload,
    bytes,
    decode: 'img-decode',
    fallback: null,
    onFail: 'error',
    timeoutMs: DEFAULT_TIMEOUT,
    license: LICENSE_TODO,
    version,
    variants: [],
  }
}

/** 柜门贴纸：首屏可见，但单张缺失不影响主结构可读，失败静默降级 */
function decal(
  id: string,
  url: string,
  bytes: number,
  version: string,
  preload = false,
): AssetEntry {
  return {
    id,
    url,
    kind: 'image',
    group: 'hero.decal',
    blocking: true,
    preload,
    bytes,
    decode: 'img-decode',
    fallback: null,
    onFail: 'degrade',
    timeoutMs: 8_000,
    license: LICENSE_TODO,
    version,
    variants: [],
  }
}

/** 作品页资源：全部非阻塞，进入对应栏目时按需加载 */
function lazyAsset(
  id: string,
  url: string,
  group: AssetGroup,
  bytes: number,
  version: string,
): AssetEntry {
  return {
    id,
    url,
    kind: 'image',
    group,
    blocking: false,
    preload: false,
    bytes,
    decode: 'img-decode',
    fallback: null,
    onFail: 'degrade',
    timeoutMs: DEFAULT_TIMEOUT,
    license: LICENSE_TODO,
    version,
    // 作品图按栏目显示宽度生成了 1x / 2x 档位，见 WORK_VARIANTS
    variants: WORK_VARIANTS[url] ?? [],
  }
}

/* ── 清单本体 ─────────────────────────────────────────────── */

/**
 * 当前 Hero 会直接交给 Three.js 的实体表面纹理。
 *
 * 唱机、书、背包、文件袋、打字机、吉他与门托盘都已经换成程序化实体网格，
 * 不再把旧透明 WebP 当作材质；右门只保留 polaroids.webp 作为三张实体卡
 * 的组合印刷层。这里必须只登记真实的纹理请求，否则 Loader 虽然
 * 显示 100%，实际上却是在等待场景根本不会用到的旧图片。
 */
const HERO_PROPS: AssetEntry[] = [
  prop('hero.posterwall', '/assets/obj/posterwall.jpg', 90231, 'e9504993', true),
  prop('hero.findaword', '/assets/obj/findaword2.webp', 30894, '193897a8', true),
  prop('hero.door4.polaroids', '/assets/obj2/polaroids.jpg', 46297, '315b3093', true),
]

/**
 * 柜门贴花。
 *
 * `hero.decalAtlas` 是 scripts/assets/pack-decals.mjs 打的**构建期图集**。
 * DecalField 只上传这张图集；decalSpecs 里的单图 URL 只是图集 UV 的稳定键，
 * 运行时不会逐张请求。因此 Loader 也只等待这一个真实请求。
 */
const HERO_DECALS: AssetEntry[] = [
  decal('hero.decalAtlas', '/assets/obj2/doorDecals.webp', 64942, '7d90505d', true),
]

/**
 * 字体阶段。Google Fonts 由 <link rel="stylesheet"> 拉取，
 * 这里只把「字体是否可用」作为一个可计量的阶段接进进度条。
 * 超时后直接放行，字体失败绝不阻塞站点。
 */
const TYPE_STAGE: AssetEntry = {
  id: 'type.display',
  url: 'https://fonts.googleapis.com/css2?family=Ultra…',
  kind: 'font',
  group: 'type.display',
  blocking: true,
  preload: false,
  // 名义权重：不代表真实字节数，只让字体阶段在进度条里占约 2.5% 的一小格。
  // 注意 document.fonts.ready 在没有待加载字体时会立即 resolve，
  // 所以这一格常常很快就满，权重必须给小。
  bytes: 24_000,
  decode: 'font-ready',
  fallback: 'system-ui 尺寸校准回退栈（见 global.css --font-*）',
  onFail: 'degrade',
  timeoutMs: 2_500,
  license: 'Google Fonts / OFL',
  version: 'css2-2026-08',
  variants: [],
}

/**
 * 作品图的响应式派生档位。
 * 宽度必须与 scripts/gen-image-variants.sh 和 imageSources.ts 的 VARIANTS 一致；
 * 换图后用文件头的命令重新生成 bytes / version。
 */
const WORK_VARIANTS: Record<string, readonly AssetVariant[]> = {
  '/assets/posters/xmas_market.webp': [
    { width: 400, url: '/assets/posters/xmas_market-400.webp', bytes: 36920, version: 'f501e6f7' },
    { width: 700, url: '/assets/posters/xmas_market-700.webp', bytes: 85972, version: 'b3946994' },
  ],
  '/assets/posters/skunk.webp': [
    { width: 400, url: '/assets/posters/skunk-400.webp', bytes: 35306, version: '2e06555b' },
    { width: 700, url: '/assets/posters/skunk-700.webp', bytes: 98464, version: '19d3ef66' },
  ],
  '/assets/posters/tiny_joy.webp': [
    { width: 400, url: '/assets/posters/tiny_joy-400.webp', bytes: 31310, version: 'f5e35c74' },
    { width: 700, url: '/assets/posters/tiny_joy-700.webp', bytes: 80262, version: '0f00dff4' },
  ],
  '/assets/posters/flower_guide.webp': [
    { width: 400, url: '/assets/posters/flower_guide-400.webp', bytes: 6890, version: 'ccd9612f' },
    { width: 700, url: '/assets/posters/flower_guide-700.webp', bytes: 17198, version: '535266a9' },
  ],
  '/assets/posters/jujube.webp': [
    { width: 400, url: '/assets/posters/jujube-400.webp', bytes: 26498, version: '02b7ed9e' },
    { width: 700, url: '/assets/posters/jujube-700.webp', bytes: 58300, version: '84484598' },
  ],
  '/assets/posters/tomato_egg.webp': [
    { width: 400, url: '/assets/posters/tomato_egg-400.webp', bytes: 17900, version: 'a970ad46' },
    { width: 700, url: '/assets/posters/tomato_egg-700.webp', bytes: 40674, version: 'd9ffb444' },
  ],
  '/assets/posters/big_blue.webp': [
    { width: 400, url: '/assets/posters/big_blue-400.webp', bytes: 41854, version: '5697f87c' },
    { width: 700, url: '/assets/posters/big_blue-700.webp', bytes: 109250, version: '7a4bd853' },
  ],
  '/assets/posters/mid_autumn.webp': [
    { width: 400, url: '/assets/posters/mid_autumn-400.webp', bytes: 24438, version: '15f4b704' },
    { width: 700, url: '/assets/posters/mid_autumn-700.webp', bytes: 55812, version: '7e13075e' },
  ],
  '/assets/posters/forest.webp': [
    { width: 400, url: '/assets/posters/forest-400.webp', bytes: 40338, version: '6b1b5031' },
    { width: 700, url: '/assets/posters/forest-700.webp', bytes: 124114, version: '72689370' },
  ],
  '/assets/posters/peach_jasmine.webp': [
    { width: 400, url: '/assets/posters/peach_jasmine-400.webp', bytes: 20232, version: 'c903e7a3' },
    { width: 700, url: '/assets/posters/peach_jasmine-700.webp', bytes: 47996, version: '8447c3d5' },
  ],
  '/assets/photo/p01.webp': [
    { width: 300, url: '/assets/photo/p01-300.webp', bytes: 32650, version: '17d9bf1e' },
    { width: 600, url: '/assets/photo/p01-600.webp', bytes: 135164, version: 'fa0e965d' },
  ],
  '/assets/photo/p02.webp': [
    { width: 300, url: '/assets/photo/p02-300.webp', bytes: 6976, version: '3c49ea4a' },
    { width: 600, url: '/assets/photo/p02-600.webp', bytes: 18354, version: '55c09cd3' },
  ],
  '/assets/photo/p03.webp': [
    { width: 300, url: '/assets/photo/p03-300.webp', bytes: 39566, version: '210e61ca' },
    { width: 600, url: '/assets/photo/p03-600.webp', bytes: 173240, version: '234b2720' },
  ],
  '/assets/photo/p04.webp': [
    { width: 300, url: '/assets/photo/p04-300.webp', bytes: 19796, version: '401cc994' },
    { width: 600, url: '/assets/photo/p04-600.webp', bytes: 59174, version: 'eb69f894' },
  ],
  '/assets/photo/p05.webp': [
    { width: 300, url: '/assets/photo/p05-300.webp', bytes: 13588, version: '0db375fa' },
    { width: 600, url: '/assets/photo/p05-600.webp', bytes: 50290, version: 'e3b39ecb' },
  ],
  '/assets/photo/p06.webp': [
    { width: 300, url: '/assets/photo/p06-300.webp', bytes: 9850, version: '9ea099ce' },
    { width: 600, url: '/assets/photo/p06-600.webp', bytes: 27204, version: '82df59d7' },
  ],
  '/assets/photo/p07.webp': [
    { width: 300, url: '/assets/photo/p07-300.webp', bytes: 24666, version: 'e349780d' },
    { width: 600, url: '/assets/photo/p07-600.webp', bytes: 96844, version: '42601a33' },
  ],
  '/assets/photo/p08.webp': [
    { width: 300, url: '/assets/photo/p08-300.webp', bytes: 20562, version: '210d68c3' },
    { width: 600, url: '/assets/photo/p08-600.webp', bytes: 85924, version: 'c36928fb' },
  ],
  '/assets/photo/p09.webp': [
    { width: 300, url: '/assets/photo/p09-300.webp', bytes: 15580, version: '0cb3cf4b' },
    { width: 600, url: '/assets/photo/p09-600.webp', bytes: 57428, version: '03ec95b0' },
  ],
  '/assets/photo/p10.webp': [
    { width: 300, url: '/assets/photo/p10-300.webp', bytes: 9446, version: '80fa0464' },
    { width: 600, url: '/assets/photo/p10-600.webp', bytes: 22702, version: 'a636554a' },
  ],
  '/assets/photo/p11.webp': [
    { width: 300, url: '/assets/photo/p11-300.webp', bytes: 12956, version: '38ca79d4' },
    { width: 600, url: '/assets/photo/p11-600.webp', bytes: 48862, version: '35d0e2a8' },
  ],
  '/assets/photo/p12.webp': [
    { width: 300, url: '/assets/photo/p12-300.webp', bytes: 10824, version: '0305ed5c' },
    { width: 600, url: '/assets/photo/p12-600.webp', bytes: 33120, version: '56bba218' },
  ],
  '/assets/photo/p13.webp': [
    { width: 300, url: '/assets/photo/p13-300.webp', bytes: 21536, version: '380c2dac' },
    { width: 600, url: '/assets/photo/p13-600.webp', bytes: 59914, version: '959b99fb' },
  ],
  '/assets/photo/p14.webp': [
    { width: 300, url: '/assets/photo/p14-300.webp', bytes: 24196, version: '807fd2af' },
    { width: 600, url: '/assets/photo/p14-600.webp', bytes: 77666, version: '683c31e4' },
  ],
  '/assets/photo/p15.webp': [
    { width: 300, url: '/assets/photo/p15-300.webp', bytes: 10050, version: '9298e1f1' },
    { width: 600, url: '/assets/photo/p15-600.webp', bytes: 34640, version: 'f999a7f6' },
  ],
  '/assets/photo/p16.webp': [
    { width: 300, url: '/assets/photo/p16-300.webp', bytes: 7010, version: 'ecdad215' },
    { width: 600, url: '/assets/photo/p16-600.webp', bytes: 19654, version: '162789b8' },
  ],
  '/assets/photo/p17.webp': [
    { width: 300, url: '/assets/photo/p17-300.webp', bytes: 8734, version: '5bd0df65' },
    { width: 600, url: '/assets/photo/p17-600.webp', bytes: 22922, version: '5703116d' },
  ],
  '/assets/photo/p18.webp': [
    { width: 300, url: '/assets/photo/p18-300.webp', bytes: 6092, version: 'b534b230' },
    { width: 600, url: '/assets/photo/p18-600.webp', bytes: 15968, version: 'd4deb8d0' },
  ],
  '/assets/photo/p19.webp': [
    { width: 300, url: '/assets/photo/p19-300.webp', bytes: 26154, version: '0e9d18ec' },
    { width: 600, url: '/assets/photo/p19-600.webp', bytes: 65408, version: '98111978' },
  ],
  '/assets/photo/p20.webp': [
    { width: 300, url: '/assets/photo/p20-300.webp', bytes: 23058, version: '551cd700' },
    { width: 600, url: '/assets/photo/p20-600.webp', bytes: 82686, version: '84aae827' },
  ],
  '/assets/photo/p21.webp': [
    { width: 300, url: '/assets/photo/p21-300.webp', bytes: 6626, version: 'ea688245' },
    { width: 600, url: '/assets/photo/p21-600.webp', bytes: 19724, version: '0231abfb' },
  ],
  '/assets/photo/p22.webp': [
    { width: 300, url: '/assets/photo/p22-300.webp', bytes: 6458, version: '3defa0cc' },
    { width: 600, url: '/assets/photo/p22-600.webp', bytes: 18892, version: '8f47f222' },
  ],
  '/assets/photo/p23.webp': [
    { width: 300, url: '/assets/photo/p23-300.webp', bytes: 6654, version: '3ff10dfc' },
    { width: 600, url: '/assets/photo/p23-600.webp', bytes: 19782, version: '2d5c18df' },
  ],
  '/assets/photo/p24.webp': [
    { width: 300, url: '/assets/photo/p24-300.webp', bytes: 7034, version: 'bd315b83' },
    { width: 600, url: '/assets/photo/p24-600.webp', bytes: 24580, version: '38e727c3' },
  ],
  '/assets/photo/p25.webp': [
    { width: 300, url: '/assets/photo/p25-300.webp', bytes: 13136, version: '4cd07a27' },
    { width: 600, url: '/assets/photo/p25-600.webp', bytes: 48406, version: '7ce89205' },
  ],
  '/assets/photo/p26.webp': [
    { width: 300, url: '/assets/photo/p26-300.webp', bytes: 15722, version: 'aca23189' },
    { width: 600, url: '/assets/photo/p26-600.webp', bytes: 61058, version: '2cd6daef' },
  ],
  '/assets/photo/p27.webp': [
    { width: 300, url: '/assets/photo/p27-300.webp', bytes: 19152, version: '14dfc2e4' },
    { width: 600, url: '/assets/photo/p27-600.webp', bytes: 64732, version: '681fb1ca' },
  ],
  '/assets/photo/p28.webp': [
    { width: 300, url: '/assets/photo/p28-300.webp', bytes: 6390, version: '39d5654f' },
    { width: 600, url: '/assets/photo/p28-600.webp', bytes: 19648, version: 'c0bcd73b' },
  ],
  '/assets/photo/p29.webp': [
    { width: 300, url: '/assets/photo/p29-300.webp', bytes: 18004, version: '38afdbb8' },
    { width: 600, url: '/assets/photo/p29-600.webp', bytes: 76172, version: 'cea7f1d8' },
  ],
  '/assets/photo/p30.webp': [
    { width: 300, url: '/assets/photo/p30-300.webp', bytes: 19744, version: 'daca2e32' },
    { width: 600, url: '/assets/photo/p30-600.webp', bytes: 86038, version: '7a328473' },
  ],
  '/assets/photo/p31.webp': [
    { width: 300, url: '/assets/photo/p31-300.webp', bytes: 11696, version: '28149950' },
    { width: 600, url: '/assets/photo/p31-600.webp', bytes: 31146, version: 'defd5d43' },
  ],
  '/assets/photo/p32.webp': [
    { width: 300, url: '/assets/photo/p32-300.webp', bytes: 9164, version: 'f3d9fc24' },
    { width: 600, url: '/assets/photo/p32-600.webp', bytes: 21598, version: '58523914' },
  ],
  '/assets/photo/p33.webp': [
    { width: 300, url: '/assets/photo/p33-300.webp', bytes: 15286, version: '45f30345' },
    { width: 600, url: '/assets/photo/p33-600.webp', bytes: 56328, version: '35893fc1' },
  ],
  '/assets/photo/p34.webp': [
    { width: 300, url: '/assets/photo/p34-300.webp', bytes: 13070, version: '3e2e9634' },
    { width: 600, url: '/assets/photo/p34-600.webp', bytes: 44740, version: '2965cab3' },
  ],
  '/assets/photo/p35.webp': [
    { width: 300, url: '/assets/photo/p35-300.webp', bytes: 13782, version: '2e645f24' },
    { width: 600, url: '/assets/photo/p35-600.webp', bytes: 56176, version: '48f85958' },
  ],
  '/assets/photo/p36.webp': [
    { width: 300, url: '/assets/photo/p36-300.webp', bytes: 23952, version: 'd2a617e1' },
    { width: 600, url: '/assets/photo/p36-600.webp', bytes: 68132, version: 'ac54496f' },
  ],
  '/assets/photo/p37.webp': [
    { width: 300, url: '/assets/photo/p37-300.webp', bytes: 34658, version: '4f7c84fc' },
    { width: 600, url: '/assets/photo/p37-600.webp', bytes: 134822, version: '86b25661' },
  ],
  '/assets/photo/p38.webp': [
    { width: 300, url: '/assets/photo/p38-300.webp', bytes: 8498, version: '3ec96e21' },
    { width: 600, url: '/assets/photo/p38-600.webp', bytes: 23058, version: 'ffc4308c' },
  ],
  '/assets/photo/p39.webp': [
    { width: 300, url: '/assets/photo/p39-300.webp', bytes: 13286, version: 'f4fad747' },
    { width: 600, url: '/assets/photo/p39-600.webp', bytes: 52258, version: '01a82efe' },
  ],
  '/assets/photo/p40.webp': [
    { width: 300, url: '/assets/photo/p40-300.webp', bytes: 15054, version: '55dc3244' },
    { width: 600, url: '/assets/photo/p40-600.webp', bytes: 57972, version: 'ed34d0c3' },
  ],
  '/assets/photo/p41.webp': [
    { width: 300, url: '/assets/photo/p41-300.webp', bytes: 21628, version: '2b5eb237' },
    { width: 600, url: '/assets/photo/p41-600.webp', bytes: 88454, version: 'e2970563' },
  ],
  '/assets/photo/p42.webp': [
    { width: 300, url: '/assets/photo/p42-300.webp', bytes: 11384, version: 'df20ce08' },
    { width: 600, url: '/assets/photo/p42-600.webp', bytes: 35812, version: 'e3b1f87d' },
  ],
  '/assets/cover/jungle.webp': [
    { width: 480, url: '/assets/cover/jungle-480.webp', bytes: 14678, version: '2149e5ef' },
    { width: 640, url: '/assets/cover/jungle-640.webp', bytes: 20032, version: '0239e0cd' },
  ],
  '/assets/cover/village.webp': [
    { width: 480, url: '/assets/cover/village-480.webp', bytes: 20130, version: 'df84c459' },
    { width: 640, url: '/assets/cover/village-640.webp', bytes: 28022, version: 'a5261435' },
  ],
  '/assets/cover/graduation.webp': [
    { width: 480, url: '/assets/cover/graduation-480.webp', bytes: 15762, version: '96f43134' },
    { width: 640, url: '/assets/cover/graduation-640.webp', bytes: 24134, version: '1f7f9598' },
  ],
}

/** 作品页资源：非首屏阻塞 */
const WORK_ASSETS: AssetEntry[] = [
  lazyAsset('poster.xmas_market', '/assets/posters/xmas_market.webp', 'work.poster', 155758, 'ba5996bb'),
  lazyAsset('poster.skunk', '/assets/posters/skunk.webp', 'work.poster', 211644, '36e4ae76'),
  lazyAsset('poster.tiny_joy', '/assets/posters/tiny_joy.webp', 'work.poster', 150000, 'e3a77147'),
  lazyAsset('poster.flower_guide', '/assets/posters/flower_guide.webp', 'work.poster', 58254, '6f82a5b3'),
  lazyAsset('poster.jujube', '/assets/posters/jujube.webp', 'work.poster', 99784, '563288c0'),
  lazyAsset('poster.tomato_egg', '/assets/posters/tomato_egg.webp', 'work.poster', 72962, '62aae7d2'),
  lazyAsset('poster.big_blue', '/assets/posters/big_blue.webp', 'work.poster', 210022, '0127cbe0'),
  lazyAsset('poster.mid_autumn', '/assets/posters/mid_autumn.webp', 'work.poster', 99650, 'de01ad6f'),
  lazyAsset('poster.forest', '/assets/posters/forest.webp', 'work.poster', 277154, 'f5f947eb'),
  lazyAsset('poster.peach_jasmine', '/assets/posters/peach_jasmine.webp', 'work.poster', 94902, '5c64fad3'),
  lazyAsset('photo.p01', '/assets/photo/p01.webp', 'work.photo', 295010, '3410a80d'),
  lazyAsset('photo.p02', '/assets/photo/p02.webp', 'work.photo', 34830, '3b31aec7'),
  lazyAsset('photo.p03', '/assets/photo/p03.webp', 'work.photo', 447486, '470b2cef'),
  lazyAsset('photo.p04', '/assets/photo/p04.webp', 'work.photo', 113128, 'b77cd652'),
  lazyAsset('photo.p05', '/assets/photo/p05.webp', 'work.photo', 115974, '0b4d8f3e'),
  lazyAsset('photo.p06', '/assets/photo/p06.webp', 'work.photo', 52520, '3cd3d545'),
  lazyAsset('photo.p07', '/assets/photo/p07.webp', 'work.photo', 222676, '2b5f4ff0'),
  lazyAsset('photo.p08', '/assets/photo/p08.webp', 'work.photo', 221584, '4cad549e'),
  lazyAsset('photo.p09', '/assets/photo/p09.webp', 'work.photo', 129234, '2a035907'),
  lazyAsset('photo.p10', '/assets/photo/p10.webp', 'work.photo', 40258, 'da4e6bb9'),
  lazyAsset('photo.p11', '/assets/photo/p11.webp', 'work.photo', 123340, '42d57f32'),
  lazyAsset('photo.p12', '/assets/photo/p12.webp', 'work.photo', 67030, '5851c1d0'),
  lazyAsset('photo.p13', '/assets/photo/p13.webp', 'work.photo', 109296, 'c4ffc4a0'),
  lazyAsset('photo.p14', '/assets/photo/p14.webp', 'work.photo', 161074, '74e7f3eb'),
  lazyAsset('photo.p15', '/assets/photo/p15.webp', 'work.photo', 80360, '955b4756'),
  lazyAsset('photo.p16', '/assets/photo/p16.webp', 'work.photo', 45178, 'a725cdc5'),
  lazyAsset('photo.p17', '/assets/photo/p17.webp', 'work.photo', 43344, '252aadb5'),
  lazyAsset('photo.p18', '/assets/photo/p18.webp', 'work.photo', 31168, 'c5aadfff'),
  lazyAsset('photo.p19', '/assets/photo/p19.webp', 'work.photo', 114296, '30dc8661'),
  lazyAsset('photo.p20', '/assets/photo/p20.webp', 'work.photo', 188404, 'd5f07b06'),
  lazyAsset('photo.p21', '/assets/photo/p21.webp', 'work.photo', 38736, '57b7596f'),
  lazyAsset('photo.p22', '/assets/photo/p22.webp', 'work.photo', 42420, 'e14bbc2c'),
  lazyAsset('photo.p23', '/assets/photo/p23.webp', 'work.photo', 42610, 'ef3093e0'),
  lazyAsset('photo.p24', '/assets/photo/p24.webp', 'work.photo', 55886, 'faf477f6'),
  lazyAsset('photo.p25', '/assets/photo/p25.webp', 'work.photo', 105586, '3daccda7'),
  lazyAsset('photo.p26', '/assets/photo/p26.webp', 'work.photo', 144446, 'd5525cf6'),
  lazyAsset('photo.p27', '/assets/photo/p27.webp', 'work.photo', 134066, '257e4c99'),
  lazyAsset('photo.p28', '/assets/photo/p28.webp', 'work.photo', 44248, 'f7148ce5'),
  lazyAsset('photo.p29', '/assets/photo/p29.webp', 'work.photo', 179318, '6f7b8643'),
  lazyAsset('photo.p30', '/assets/photo/p30.webp', 'work.photo', 222100, '532ec173'),
  lazyAsset('photo.p31', '/assets/photo/p31.webp', 'work.photo', 60236, '79c2f246'),
  lazyAsset('photo.p32', '/assets/photo/p32.webp', 'work.photo', 38770, '0f531088'),
  lazyAsset('photo.p33', '/assets/photo/p33.webp', 'work.photo', 130626, 'a2e7fd1f'),
  lazyAsset('photo.p34', '/assets/photo/p34.webp', 'work.photo', 94118, '699958e4'),
  lazyAsset('photo.p35', '/assets/photo/p35.webp', 'work.photo', 136042, 'f22118ba'),
  lazyAsset('photo.p36', '/assets/photo/p36.webp', 'work.photo', 130762, '607aa34b'),
  lazyAsset('photo.p37', '/assets/photo/p37.webp', 'work.photo', 313868, '5b621d35'),
  lazyAsset('photo.p38', '/assets/photo/p38.webp', 'work.photo', 47402, 'ed9e3cef'),
  lazyAsset('photo.p39', '/assets/photo/p39.webp', 'work.photo', 133666, 'a5856687'),
  lazyAsset('photo.p40', '/assets/photo/p40.webp', 'work.photo', 141514, 'd16354f8'),
  lazyAsset('photo.p41', '/assets/photo/p41.webp', 'work.photo', 220558, '349dc0ea'),
  lazyAsset('photo.p42', '/assets/photo/p42.webp', 'work.photo', 72862, 'dd8af13d'),
  lazyAsset('cover.jungle', '/assets/cover/jungle.webp', 'work.cover', 34454, 'f71db238'),
  lazyAsset('cover.village', '/assets/cover/village.webp', 'work.cover', 42268, '94c2dc3e'),
  lazyAsset('cover.graduation', '/assets/cover/graduation.webp', 'work.cover', 44064, 'ad864a24'),
]

/** 全站资源清单 */
export const ASSET_MANIFEST: readonly AssetEntry[] = [
  ...HERO_PROPS,
  ...HERO_DECALS,
  TYPE_STAGE,
  ...WORK_ASSETS,
]

/** 首屏阻塞资源：只有 Hero 真正采样的纹理 + 字体阶段 */
export const BLOCKING_ASSETS: readonly AssetEntry[] = ASSET_MANIFEST.filter((a) => a.blocking)

/** 需要在 index.html 里 <link rel="preload"> 的资源 */
export const PRELOAD_ASSETS: readonly AssetEntry[] = ASSET_MANIFEST.filter((a) => a.preload)

export const ASSETS_BY_ID: ReadonlyMap<string, AssetEntry> = new Map(
  ASSET_MANIFEST.map((a) => [a.id, a]),
)

export function assetsInGroup(group: AssetGroup): AssetEntry[] {
  return ASSET_MANIFEST.filter((a) => a.group === group)
}

/**
 * 各栏目的派生档位宽度，从清单实际登记的变体反推。
 * imageSources.ts 目前自己硬编码了一份同样的宽度表；以清单为准，
 * 两边不一致时开发期的 auditWorkImageSources() 会点名。
 */
export const VARIANT_WIDTHS: Readonly<Partial<Record<AssetGroup, readonly number[]>>> =
  ASSET_MANIFEST.reduce<Partial<Record<AssetGroup, readonly number[]>>>((acc, a) => {
    if (a.variants.length > 0 && acc[a.group] === undefined) {
      acc[a.group] = a.variants.map((v) => v.width)
    }
    return acc
  }, {})

/** 清单里登记的全部文件数（原图 + 派生档位） */
export const ASSET_FILE_COUNT = ASSET_MANIFEST.reduce(
  (n, a) => n + (a.kind === 'image' ? 1 + a.variants.length : 0),
  0,
)

const BLOCKING_BYTES = BLOCKING_ASSETS.reduce((n, a) => n + a.bytes, 0)

/* ============================================================================
 * 运行时：真实进度统计
 * ========================================================================== */

export type AssetStatus =
  | 'pending' // 尚未开始
  | 'loading' // 请求中
  | 'decoding' // 网络已完成，正在 decode()
  | 'ready' // 已 decode，可用于渲染
  | 'degraded' // 失败但允许放行
  | 'failed' // 失败且需要提示重试

export type AssetRuntime = {
  entry: AssetEntry
  status: AssetStatus
  attempts: number
  /** 请求完成耗时（毫秒） */
  netMs: number | null
  /** decode() 耗时（毫秒） */
  decodeMs: number | null
  error: string | null
}

export type LoadSnapshot = {
  /** 0–100 的真实进度，单调递增 */
  progress: number
  /** 所有阻塞资源都有了结果（成功、降级或失败） */
  settled: boolean
  /** settled 且没有需要提示的硬失败 */
  ok: boolean
  /** 正在重试中 */
  retrying: boolean
  /** 需要提示的失败项 */
  failed: readonly AssetRuntime[]
  /** 已经 ready 的阻塞项数量 */
  readyCount: number
  /** 阻塞项总数 */
  totalCount: number
  /** 从开始加载到现在（或到 settled）的毫秒数 */
  elapsedMs: number
  items: readonly AssetRuntime[]
}

/** 网络阶段在单项权重里占的比例，剩下的归 decode() */
const NET_SHARE = 0.55
const MAX_ATTEMPTS = 3
const RETRY_BACKOFF = [350, 1_000]
/**
 * 首屏加载硬预算。到点仍未结算的项一律按各自的 onFail 就地结算，
 * 保证 Loader 无论如何都会在这个时间内走完 100%，不会永久卡住。
 */
const HARD_DEADLINE_MS = 12_000

const runtimes: AssetRuntime[] = BLOCKING_ASSETS.map((entry) => ({
  entry,
  status: 'pending',
  attempts: 0,
  netMs: null,
  decodeMs: null,
  error: null,
}))

/** 持有 Image 引用，避免解码结果在 DOM 用到之前被回收 */
const warmed: HTMLImageElement[] = []

const listeners = new Set<() => void>()
let startedAt = 0
let settledAt = 0
let progressFloor = 0
let retryingCount = 0
let snapshot: LoadSnapshot = buildSnapshot()
let loadPromise: Promise<LoadSnapshot> | null = null
/** 硬预算到点后置位，正在重试的项会就地停下，不再把状态拉回 loading */
let aborted = false

function isSettled(status: AssetStatus) {
  return status === 'ready' || status === 'degraded' || status === 'failed'
}

function statusShare(rt: AssetRuntime): number {
  switch (rt.status) {
    case 'pending':
      return 0
    case 'loading':
      return 0
    case 'decoding':
      return NET_SHARE
    default:
      // ready / degraded / failed 都算已结算，保证进度不会卡住
      return 1
  }
}

function buildSnapshot(): LoadSnapshot {
  let weighted = 0
  let readyCount = 0
  const failed: AssetRuntime[] = []
  let settled = true

  for (const rt of runtimes) {
    weighted += rt.entry.bytes * statusShare(rt)
    if (rt.status === 'ready') readyCount += 1
    if (rt.status === 'failed') failed.push(rt)
    if (rt.status === 'pending' || rt.status === 'loading' || rt.status === 'decoding') {
      settled = false
    }
  }

  const raw = BLOCKING_BYTES > 0 ? (weighted / BLOCKING_BYTES) * 100 : 100
  // 单调递增：显示值只允许往上走
  progressFloor = Math.max(progressFloor, Math.min(100, raw))

  return {
    progress: settled ? 100 : Math.min(99, progressFloor),
    settled,
    ok: settled && failed.length === 0,
    retrying: retryingCount > 0,
    failed,
    readyCount,
    totalCount: runtimes.length,
    elapsedMs: startedAt === 0 ? 0 : (settledAt || performance.now()) - startedAt,
    items: runtimes,
  }
}

function emit() {
  snapshot = buildSnapshot()
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/** 加载一张图片：load 事件记网络耗时，decode() 完成才算真正可渲染 */
function warmImage(rt: AssetRuntime, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    warmed.push(img)
    img.decoding = 'async'
    // 透明物件图没有跨域需求，crossOrigin 留空以复用 <img> 的缓存键
    const t0 = performance.now()
    let done = false

    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      img.src = ''
      reject(new Error(`超时 ${rt.entry.timeoutMs}ms`))
    }, rt.entry.timeoutMs)

    const fail = (msg: string) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      reject(new Error(msg))
    }

    img.onerror = () => fail('请求失败或不是可解码的图片')
    img.onload = () => {
      if (done) return
      rt.netMs = performance.now() - t0
      rt.status = 'decoding'
      emit()
      const t1 = performance.now()
      const finish = () => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        rt.decodeMs = performance.now() - t1
        resolve()
      }
      // 部分浏览器对游离节点的 decode() 会抛 EncodingError，
      // 但 load 已成功说明位图可用，按成功处理即可。
      img.decode().then(finish, finish)
    }

    img.src = url
  })
}

/**
 * Loader 首屏真正用到的字面。
 * Ultra 是超粗板衬，回退栈里的 Playfair / serif 是细衬线，两者差距极大，
 * 换字的瞬间非常刺眼，所以必须点名等这一支。
 */
const CRITICAL_FACES = ['400 1em Ultra', '300 1em Inter']

function warmFonts(rt: AssetRuntime): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve()
  const t0 = performance.now()
  rt.status = 'decoding'
  emit()
  // 只等 document.fonts.ready 是不够的：还没有任何字面进入待加载队列时它会立刻
  // resolve，于是这一格瞬间就满，但 Ultra 其实还在路上。先用 fonts.load() 把
  // 关键字面显式拉起来，再等整体 ready，这一格才代表真实状态。
  const load = Promise.all(CRITICAL_FACES.map((f) => document.fonts.load(f)))
    .then(() => document.fonts.ready)
    .then(() => undefined)
  return Promise.race([
    load,
    sleep(rt.entry.timeoutMs).then(() => {
      throw new Error(`字体未在 ${rt.entry.timeoutMs}ms 内就绪，使用回退字体栈`)
    }),
  ]).then(() => {
    rt.decodeMs = performance.now() - t0
  })
}

async function runOne(rt: AssetRuntime) {
  // 字体阶段本身已经带超时，重试没有意义，只会白白吃掉首屏预算
  const maxAttempts = rt.entry.decode === 'font-ready' ? 1 : MAX_ATTEMPTS

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (aborted) break
    rt.attempts = attempt
    rt.status = 'loading'
    rt.error = null
    emit()
    try {
      if (rt.entry.decode === 'font-ready') await warmFonts(rt)
      else await warmImage(rt, rt.entry.url)
      rt.status = 'ready'
      emit()
      return
    } catch (err) {
      rt.error = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts && !aborted) {
        await sleep(RETRY_BACKOFF[attempt - 1] ?? 1_000)
        continue
      }
    }
  }

  // 重试用尽：先试 fallback，再按 onFail 决定是否需要提示用户
  if (!aborted && rt.entry.fallback && rt.entry.decode === 'img-decode') {
    try {
      await warmImage(rt, rt.entry.fallback)
      rt.status = 'degraded'
      emit()
      return
    } catch {
      /* fallback 也失败，继续往下 */
    }
  }
  if (isSettled(rt.status)) return
  rt.status = rt.entry.onFail === 'degrade' ? 'degraded' : 'failed'
  emit()
}

/** 硬预算到点：把还没结果的项就地结算，Loader 才不会无限等下去 */
function forceSettle() {
  aborted = true
  let changed = false
  for (const rt of runtimes) {
    if (isSettled(rt.status)) continue
    rt.error = rt.error ?? `超出首屏加载预算 ${HARD_DEADLINE_MS}ms`
    rt.status = rt.entry.onFail === 'degrade' ? 'degraded' : 'failed'
    changed = true
  }
  if (changed) emit()
}

/** 启动首屏阻塞资源加载（幂等，返回同一个 promise） */
export function startBlockingLoad(): Promise<LoadSnapshot> {
  if (loadPromise) return loadPromise
  startedAt = performance.now()
  emit()
  const watchdog = window.setTimeout(forceSettle, HARD_DEADLINE_MS)
  loadPromise = Promise.all(runtimes.map(runOne)).then(() => {
    window.clearTimeout(watchdog)
    settledAt = performance.now()
    emit()
    if (import.meta.env.DEV) {
      reportToConsole()
      void auditPreloadLinks()
      void auditWorkImageSources()
    }
    return snapshot
  })
  return loadPromise
}

/** 供后续状态机 await 的就绪 promise */
export function blockingAssetsReady(): Promise<LoadSnapshot> {
  return startBlockingLoad()
}

/** 重试所有硬失败项。进度保持在原位不回退，成功后错误态自动消失 */
export function retryFailedAssets(): void {
  const broken = runtimes.filter((rt) => rt.status === 'failed')
  if (broken.length === 0) return
  // 用户显式重试：解除硬预算，并给这批资源一个新的预算窗口
  aborted = false
  window.setTimeout(forceSettle, HARD_DEADLINE_MS)
  retryingCount += broken.length
  emit()
  for (const rt of broken) {
    void runOne(rt).finally(() => {
      retryingCount = Math.max(0, retryingCount - 1)
      emit()
    })
  }
}

/** 字体阶段的资源 ID */
export const FONT_STAGE_ID = 'type.display'

/**
 * 展示字体是否已经可以用来排版（含超时降级）。
 * Loader 用它决定 WELCOME 什么时候上屏，避免细衬线回退跳成 Ultra。
 */
export function isDisplayFontReady(snap: LoadSnapshot): boolean {
  const rt = snap.items.find((i) => i.entry.id === FONT_STAGE_ID)
  return rt === undefined || isSettled(rt.status)
}

/** React 订阅入口 */
export function useBlockingAssets(): LoadSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

/* ============================================================================
 * 开发期报告
 * ========================================================================== */

function reportToConsole() {
  const rows = runtimes.map((rt) => ({
    id: rt.entry.id,
    状态: rt.status,
    分组: rt.entry.group,
    'KB': Math.round(rt.entry.bytes / 102.4) / 10,
    '网络ms': rt.netMs === null ? '-' : Math.round(rt.netMs),
    '解码ms': rt.decodeMs === null ? '-' : Math.round(rt.decodeMs),
    次数: rt.attempts,
    url: rt.entry.url,
  }))
  const bad = runtimes.filter((rt) => rt.status === 'failed' || rt.status === 'degraded')
  const total = Math.round(snapshot.elapsedMs)
  const net = Math.max(0, ...runtimes.map((r) => r.netMs ?? 0))
  const dec = Math.max(0, ...runtimes.map((r) => r.decodeMs ?? 0))

  console.groupCollapsed(
    `[assets] 首屏阻塞 ${snapshot.readyCount}/${snapshot.totalCount} ready · ` +
      `总耗时 ${total}ms · 最慢网络 ${Math.round(net)}ms · 最慢解码 ${Math.round(dec)}ms`,
  )
  console.table(rows)
  if (bad.length > 0) {
    console.warn(
      '[assets] 失败/降级资源：\n' +
        bad.map((rt) => `  ${rt.status.padEnd(8)} ${rt.entry.url}  ← ${rt.error}`).join('\n'),
    )
  }
  reportSizeDrift()
  console.groupEnd()
}

/**
 * 清单登记的体积/版本会随素材重新压制而过期，进度加权就会失真。
 * 用 Resource Timing 的真实 encodedBodySize 对账，偏差超过 5% 就点名，
 * 提示按文件头的命令重新生成 bytes 和 version。零额外请求。
 */
function reportSizeDrift() {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return
  const seen = new Map<string, number>()
  for (const e of performance.getEntriesByType('resource')) {
    const size = (e as PerformanceResourceTiming).encodedBodySize
    if (size > 0) seen.set(new URL(e.name, location.origin).pathname, size)
  }
  const drift: string[] = []
  const check = (url: string, bytes: number) => {
    const real = seen.get(url)
    if (real === undefined) return
    if (Math.abs(real - bytes) / bytes > 0.05) drift.push(`${url}  清单 ${bytes}B → 实际 ${real}B`)
  }
  for (const a of ASSET_MANIFEST) {
    if (a.kind !== 'image') continue
    check(a.url, a.bytes)
    // 派生档位也要对账：srcset 实际取的往往是变体而不是原图
    for (const v of a.variants) check(v.url, v.bytes)
  }
  if (drift.length > 0) {
    console.warn(
      '[assets] 清单登记体积已过期，请重新生成 bytes / version：\n  ' + drift.join('\n  '),
    )
  }
}

/**
 * 跨模块契约检查：imageSources.ts 的 workImage() 自己拼 srcset，
 * 那份宽度表和本清单是两处独立的真相，改了一处忘了另一处就会请求到 404。
 * 这里把它真实生成的每个 URL 拿来和清单对一遍。
 *
 * 用动态 import 是为了不把作品页模块拽进主包；生产构建里整段是死代码。
 */
async function auditWorkImageSources(): Promise<void> {
  try {
    const { workImage } = await import('../components/work/imageSources')
    const known = new Set<string>()
    for (const a of ASSET_MANIFEST) {
      known.add(a.url)
      for (const v of a.variants) known.add(v.url)
    }
    const missing: string[] = []
    for (const a of ASSET_MANIFEST) {
      const m = /^\/assets\/(photo|posters|mag|cover)\/([^/]+)\.webp$/.exec(a.url)
      if (!m) continue
      const dir = m[1] as Parameters<typeof workImage>[0]
      const { src, srcSet } = workImage(dir, m[2])
      const urls = [src, ...srcSet.split(',').map((x) => x.trim().split(/\s+/)[0])]
      for (const u of urls) {
        if (!known.has(u)) missing.push(`${u}  ← workImage('${dir}', '${m[2]}')`)
      }
    }
    if (missing.length > 0) {
      console.warn('[assets] imageSources 会请求清单里没有登记的档位：\n  ' + missing.join('\n  '))
    }
  } catch {
    /* 作品页模块不可用时跳过，这只是开发期的一致性检查 */
  }
}

/**
 * 校验 index.html 的 preload 与清单是否一致，并确认 URL 真的返回图片
 * （SPA fallback 会用 HTML 冒充 200）。
 */
export async function auditPreloadLinks(): Promise<void> {
  if (typeof document === 'undefined') return
  const declared = new Set(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')).map(
      (l) => new URL(l.href, location.origin).pathname,
    ),
  )
  const expected = new Set(PRELOAD_ASSETS.map((a) => a.url))

  const missing = [...expected].filter((u) => !declared.has(u))
  const extra = [...declared].filter((u) => !expected.has(u))
  if (missing.length) console.warn('[preload] 清单里标了 preload 但 index.html 没写：', missing)
  if (extra.length) console.warn('[preload] index.html 多出的 preload（清单里没有）：', extra)

  const problems: string[] = []
  await Promise.all(
    [...declared].map(async (url) => {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'force-cache' })
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok) problems.push(`${url} → HTTP ${res.status}`)
        else if (!type.startsWith('image/')) problems.push(`${url} → content-type ${type}（疑似 SPA fallback 返回 HTML）`)
      } catch (err) {
        problems.push(`${url} → ${err instanceof Error ? err.message : String(err)}`)
      }
    }),
  )
  if (problems.length) console.error('[preload] 预加载 URL 校验失败：\n  ' + problems.join('\n  '))
  else console.info(`[preload] ${declared.size} 条预加载 URL 全部真实返回图片`)
}

/* 模块被引入即开始加载，不等任何组件挂载（「页面启动后立即挂载资源层」） */
if (typeof window !== 'undefined') void startBlockingLoad()
