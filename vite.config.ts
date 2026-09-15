import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相对路径 base：构建产物可双击 index.html 以 file:// 方式打开，
  // 此时页内 file:// 游戏链接才能被浏览器放行（http 页面会拦截 file 链接）。
  base: './',
  // 监听所有网卡，方便手机等同一局域网设备用 IP:端口 访问
  server: { host: true, port: 5178 },
  preview: { host: true, port: 4178 },
})
