# Locker Folio — 谌柚的个人作品集

一个以储物柜为载体的交互式个人作品集：加载页 → 揭幕 → 柜体旋转推近并开门 →
柜内与门上的实体物件对应 ABOUT / SKILLS / SELECTED WORK / CONTACT 四个入口，
每件物件都能在自己的承载面上拖动，点击后镜头局部聚焦再挂载内容浮层。

首屏是真实的 Three.js 场景（柜体、柜门、隔板、打字机、吉他、唱片机等全是网格，
不是贴片），内容页是 DOM 浮层。

## 运行

```bash
bun install
bun run dev       # http://localhost:5199（监听所有网卡，手机可同网段访问）
bun run build     # tsc -b && vite build
bun run preview   # http://localhost:4178
```

Node 版工具链同样可用，但仓库锁文件是 `bun.lock`，请统一用 bun。

## 部署

```bash
bun run deploy    # build + wrangler deploy（Cloudflare Pages）
```
