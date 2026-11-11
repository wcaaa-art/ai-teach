import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 端口被占用时直接报错，不再悄悄换到 5174（换端口后后端 CORS 白名单会拒绝，前端只拿到 HTML 错误页）。
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' }
  },
  // preview（4173）也走同一套代理，否则静态预览下 /api 会回落到 index.html。
  preview: { port: 4173, strictPort: true, proxy: { '/api': 'http://localhost:3001' } },
  build: { sourcemap: true }
})
