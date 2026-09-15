/* 站点全部文案与作品数据 —— 与参考逐帧核对整理 */

export const SITE = {
  owner: 'CHEN YOU',
  tagline: "CHEN YOU — PORTFOLIO '26",
  year: '2026',
}

/* ── 顶部导航 ─────────────────────────────────────────── */
export const NAV = [
  { id: 'about', label: 'ABOUT' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'work', label: 'SELECTED WORK' },
  { id: 'contact', label: 'CONTACT' },
] as const

/* ── ABOUT：工牌 ─────────────────────────────────────── */
export const ABOUT = {
  cardNo: 'NO. xxx',
  title: ['BASIC', 'INFORMATION'],
  titleCn: '个人简介',
  sub: 'PERSONAL PORTFOLIO ID CARD',
  fields: [
    { k: 'NAME / 姓名', v: '谌柚' },
    { k: 'GENDER / 性别', v: '女' },
    { k: 'AGE / 年龄', v: '19' },
    { k: 'CLASS / 班级', v: 'XXX' },
    { k: 'EDUCATION / 学历', v: '本科' },
    { k: 'MAJOR / 专业', v: '数字媒体艺术' },
  ],
  email: '78420253@qq.com',
  phone: '15116760337',
  stampTop: 'CERTIFIED',
  stampMid: 'xxx',
  stampRing: 'PERSONAL PORTFOLIO · xxx ·',
  footL: 'IN MY CREATIVE ERA',
  footR: 'PERSONAL DESIGN PORTFOLIO · 2026',
}

/* ── SKILLS：三张卡片 ─────────────────────────────────── */
export type SkillCard = {
  no: string
  kicker: string
  title: string
  desc: string
  rows: { k: string; v: string }[]
  bg: string
  fg: string
}

export const SKILLS: SkillCard[] = [
  {
    no: '01',
    kicker: '01 / AIGC VISUAL GENERATION',
    title: 'AIGC 视觉生成',
    desc: '熟练使用即梦 Dreamina 完成 AI 生图与图生视频，掌握提示词工程，具备多轮抽卡筛选与画面迭代优化能力。',
    rows: [
      { k: 'IMAGE', v: '即梦 Dreamina · AI 生图 / 图生视频' },
      { k: 'PROMPT', v: '提示词工程 / 多轮抽卡 / 画面迭代' },
      { k: 'CASE', v: '《武松打虎》提示词校准历史国风画面特征' },
      { k: 'PROJECT', v: 'AIGC 游戏视觉开发 · 48h 极限实战（视觉美术负责人）' },
      { k: 'NOTE', v: '水怪实验室 / CIGA Game Jam《森屿》《四渡赤水》：批量生图迭代提示词，按期交付成套视觉素材' },
    ],
    bg: '#1b28d8',
    fg: '#ffffff',
  },
  {
    no: '02',
    kicker: '02 / EDIT & POST-PRODUCTION',
    title: '后期剪辑与包装',
    desc: '熟练使用剪映完成视频剪辑、转场特效与音效合成，高效处理碎片化的 AI 素材。',
    rows: [
      { k: 'EDIT', v: '剪映 · 剪辑 / 转场特效 / 音效合成' },
      { k: 'CASE', v: '《毕业故事会》转场配乐弥补 AI 画面断层' },
      { k: 'PROJECT', v: '人文纪实影像 · AI 辅助叙事（项目组长）' },
      { k: 'NOTE', v: '《毕业故事会》《井底十载 山村新颜》：AI 提炼口述故事线，人工剪辑调色配乐，获官方平台发布认可' },
    ],
    bg: '#c8f322',
    fg: '#12140f',
  },
  {
    no: '03',
    kicker: '03 / TOOLS & PLANNING',
    title: '辅助工具与策划',
    desc: '熟练使用 ChatGPT-4o、Kimi 完成剧本发散、分镜脚本编写与素材分析，具备团队沟通与 AIGC 工作流落地能力。',
    rows: [
      { k: 'AI', v: 'ChatGPT-4o / Kimi · 剧本·分镜·素材分析' },
      { k: 'TOOLS', v: '可灵 AI / 即梦 / 剪映 / ElevenLabs' },
      { k: 'PROJECT', v: '南京人文「白日梦」AI 概念短片（备赛探索）' },
      { k: 'NOTE', v: '城墙·秦淮河 × 梦境：ChatGPT 分镜 → 即梦生图 → 可灵动态 → 剪映成片，已跑通轻量化工作流' },
    ],
    bg: '#ffffff',
    fg: '#14161a',
  },
]

/* ── SELECTED WORK：四个文件夹 ───────────────────────── */
export const FOLDERS = [
  {
    id: 'video',
    en: ['VIDEO'],
    cn: '影像作品',
    bg: '#0b0b0d',
    fg: '#e0322a',
    cnFg: '#e0322a',
    x: -30,
    y: 12,
    rot: -6,
    z: 1,
  },
  {
    id: 'design',
    en: ['DESIGN'],
    cn: '视觉类设计',
    bg: '#c8f322',
    fg: '#1b28d8',
    cnFg: '#1b28d8',
    x: 0,
    y: 0,
    rot: -7,
    z: 3,
  },
  {
    id: 'photograph',
    en: ['PHOTO', 'GRAPH'],
    cn: '摄影作品',
    bg: '#1b28d8',
    fg: '#c8f322',
    cnFg: '#ffffff',
    x: 30,
    y: -18,
    rot: 3,
    z: 2,
  },
  {
    id: 'game',
    en: ['GAME'],
    cn: '游戏作品',
    bg: '#ffffff',
    fg: '#1b1d21',
    cnFg: '#1b1d21',
    x: 30,
    y: 20,
    rot: 5,
    z: 2,
  },
] as const

/* ── GAME：两个游戏项目 ─────────────────────────────── */
export const GAMES = [
  {
    id: 'anchor',
    name: '记忆之锚',
    cover: '/assets/game/anchor.jpg',
    url: 'file:///D:/aaa/uuu/个人档案/游戏/记忆之锚',
  },
  {
    id: 'flappy',
    name: '弗莱皮鸟',
    cover: '/assets/game/flappy.jpg',
    url: 'file:///D:/aaa/uuu/个人档案/游戏/弗莱皮鸟',
  },
] as const

/* ── DESIGN › 01 POSTERS ─────────────────────────────── */
export const POSTERS = [
  { src: 'xmas_market', title: "ST AUGUSTINE'S CHRISTMAS MARKET" },
  { src: 'skunk', title: 'SKUNK · 林间诗' },
  { src: 'tiny_joy', title: 'TINY JOY · THE WARMTH OF LITTLE CREATURES' },
  { src: 'flower_guide', title: 'CHAMOMILE FLOWER GUIDE' },
  { src: 'jujube', title: '闻枣香 品心甜' },
  { src: 'tomato_egg', title: 'TOMATO & EGG ON CAPO' },
  { src: 'big_blue', title: 'THE BIG BLUE · 深海来客' },
  { src: 'mid_autumn', title: '月满中秋 · 节日快乐' },
  { src: 'forest', title: 'FOREST · NO.02 WOODLAND ISSUE' },
  { src: 'peach_jasmine', title: '月圆就见面 · 白桃茉莉' },
]

/* ── DESIGN › 02 MAGAZINE ────────────────────────────── */
export const MAGAZINE_PAGES = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']

/* ── DESIGN › 03 IP DESIGN ───────────────────────────── */
export const IP_DESIGN = {
  kicker: '03 / IP DESIGN',
  title: 'IP DESIGN',
  cn: 'IP 形象设计',
  desc: '围绕一个圆润的原创角色展开：从基础形体、材质到延展物料，建立一套可复用的形象语言。',
  swatches: [
    { name: 'CLAY', hex: '#e3d3bb' },
    { name: 'SAND', hex: '#d6c3a5' },
    { name: 'CREAM', hex: '#f2eadd' },
    { name: 'INK', hex: '#2c2925' },
  ],
  specs: [
    { k: 'FORM', v: '球体 / 圆角几何体' },
    { k: 'MATERIAL', v: '哑光陶土 · 微磨砂' },
    { k: 'OUTPUT', v: '3D 模型 / 表情包 / 周边' },
  ],
}

/* ── PHOTOGRAPH ──────────────────────────────────────── */
export const PHOTOS = [
  'p01',
  'p02',
  'p03',
  'p04',
  'p05',
  'p06',
  'p07',
  'p08',
  'p09',
  'p10',
  'p11',
  'p12',
  'p13',
  'p14',
  'p15',
  'p16',
  'p17',
  'p18',
  'p19',
  'p20',
  'p21',
  'p22',
  'p23',
  'p24',
  'p25',
  'p26',
  'p27',
  'p28',
  'p29',
  'p30',
  'p31',
  'p32',
  'p33',
  'p34',
  'p35',
  'p36',
  'p37',
  'p38',
  'p39',
  'p40',
  'p41',
  'p42',
]

/* ── VIDEO ───────────────────────────────────────────── */
export const VIDEOS = [
  {
    no: '01',
    en: 'ANIMATION SHORT',
    cn: '丛林动画短片',
    desc: '手绘风丛林场景动画短片',
    cover: 'jungle',
    href: '/assets/video/jungle.mp4',
  },
  {
    no: '02',
    en: 'DOCUMENTARY',
    cn: '山村新颜 · 纪实短片',
    desc: '乡村纪实短片《井底十载 山村新颜》',
    cover: 'village',
    href: '/assets/video/village.mp4',
  },
  {
    no: '03',
    en: 'GRADUATION VIDEO',
    cn: '毕业纪念短片',
    desc: '毕业季纪念短片',
    cover: 'graduation',
    href: '/assets/video/graduation.mp4',
  },
  {
    no: '04',
    en: 'GUOFENG ANIMATION',
    cn: '国风动画短片',
    desc: '红树青烟 · 国风氛围动画短片',
    cover: 'guofeng',
    href: '/assets/video/guofeng.mp4',
  },
]


/* ── WEBSITE & WRITING ───────────────────────────────── */
/* href 是占位：三个站点还没有可公开的正式地址，一律先指向 '#'，
   面板上的 OPEN PROJECT 同时带 aria-disabled。拿到真实链接后只改这三处。
   glow 是每张封面的主色，用来喂 .wsc__glow 的背景光晕 —— 原来那三个值
   （#f6e9c8 / #f7dcd8 / #dceccd）是掺了大量白的浅色，铺在 --paper #f8f7fa 上
   几乎没有色差，看不出光晕；这里往各自封面的主色方向加饱和度。 */
export const WEBSITES = [
  {
    no: '01',
    slug: 'COFFEE / IN CHINA',
    title: ['Coffee / In', 'China'],
    kicker: 'DATA JOURNALISM · WEB',
    desc: '中国咖啡市场在消费降级、价格竞争与情绪经济之间的增长逻辑。',
    cover: 'coffee',
    glow: '#f2d49a', // 咖啡封面的焦糖黄
    href: '#',
  },
  {
    no: '02',
    slug: 'SHORT DRAMA / OVERSEAS',
    title: ['Short Drama /', 'Overseas'],
    kicker: 'FEATURE · WEB',
    desc: '短剧出海：内容工业化生产与海外分发链路的一次拆解。',
    cover: 'drama',
    glow: '#f0bfa4', // 短剧封面的暖橘
    href: '#',
  },
  {
    no: '03',
    slug: 'WECHAT / ARTICLE',
    title: ['WeChat /', 'Article'],
    kicker: 'EDITORIAL · 图文',
    desc: '公众号长图文写作与版式：把调研转成可读、可传播的叙事。',
    cover: 'wechat',
    glow: '#d7e3a4', // 图文封面的草绿
    href: '#',
  },
]

/* ── CONTACT：软木板便签 ─────────────────────────────── */
export const NOTE_COLORS = ['#cfe0c3', '#f0e6a8', '#e8b7b7', '#a9c9dd', '#e5cfe0', '#d8cdb8']

export const SEED_NOTES = [
  { id: 's1', text: '', color: '#cfe0c3', x: 14, y: 42, rot: -2 },
  { id: 's2', text: '', color: '#f0e6a8', x: 70, y: 12, rot: 3 },
  { id: 's3', text: '', color: '#e8b7b7', x: 80, y: 33, rot: -3 },
]
