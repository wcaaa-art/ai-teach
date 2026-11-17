import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// unplugin-vue-components 是运行时按需解析 el-* 组件的，vite 的入口静态扫描看不到它们，
// 结果就是"先优化一批、跑起来又发现一批"，反复重写依赖缓存目录。
// 这里把全项目用到的组件样式一次性列全，让预构建一次到位。
// 新增组件时记得同步补一条，否则开发服务器会因为重写缓存而重启一次。
const ELEMENT_COMPONENTS = [
  'alert', 'button', 'checkbox', 'checkbox-group', 'collapse', 'collapse-item', 'date-picker',
  'dialog', 'divider', 'dropdown', 'dropdown-item', 'dropdown-menu', 'form', 'form-item',
  'input', 'input-number', 'option', 'popover', 'progress', 'radio', 'radio-button',
  'radio-group', 'rate', 'segmented', 'select', 'slider', 'switch', 'tag', 'upload',
  // 这几个是函数式调用的（ElMessage / ElMessageBox / v-loading），模板里没有对应标签。
  'message', 'message-box', 'loading'
]
const ELEMENT_STYLE_ENTRIES = [
  'element-plus/es',
  'element-plus/es/components/base/style/css',
  ...ELEMENT_COMPONENTS.map(name => `element-plus/es/components/${name}/style/css`)
]

// 语音推理内核（public/ort）是靠动态 import 加载的，vite 会给这类请求加 ?import 查询串，
// 而 public 目录的文件走静态服务，带参数就 404 了。这里在静态服务之前把查询串剥掉。
// 只在开发/预览服务器上需要；构建产物是纯静态文件，不会出现这个后缀。
const stripPublicImportQuery = {
  name: 'strip-public-import-query',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && req.url.startsWith('/ort/') && req.url.includes('?import')) req.url = req.url.replace('?import', '')
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && req.url.startsWith('/ort/') && req.url.includes('?import')) req.url = req.url.replace('?import', '')
      next()
    })
  }
}

export default defineConfig({
  plugins: [
    vue(),
    // 模板里的 el-* 组件按需引入并带上对应样式，避免整包 Element Plus 打进入口 chunk。
    Components({ resolvers: [ElementPlusResolver()], dts: false }),
    stripPublicImportQuery
  ],
  optimizeDeps: {
    include: ELEMENT_STYLE_ENTRIES,
    // 语音模型的运行库体积大、只在背诵窗口用到，由浏览器按 ESM 直接加载，
    // 不参与预构建，免得每次新增依赖都重写整块缓存。
    // 这三个是一整条语音链路：由浏览器直接加载自己的 ESM 入口，
    // 一旦让 vite 预构建，运行时又会发现新的子依赖并重写整块缓存。
    exclude: ['@huggingface/transformers', 'onnxruntime-web', 'onnxruntime-common']
  },
  server: {
    port: 5173,
    // 端口被占用时直接报错，不再悄悄换到 5174（换端口后后端 CORS 白名单会拒绝，前端只拿到 HTML 错误页）。
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' }
  },
  // preview（4173）也走同一套代理，否则静态预览下 /api 会回落到 index.html。
  preview: { port: 4173, strictPort: true, proxy: { '/api': 'http://localhost:3001' } },
  build: {
    // 生产包默认不带 sourcemap：源码映射会把整份业务代码连同注释暴露给评审浏览器，
    // 体积也翻倍。本地排障需要时用 BUILD_SOURCEMAP=1 npm run build。
    sourcemap: process.env.BUILD_SOURCEMAP === '1',
    rollupOptions: {
      output: {
        // 把稳定、几乎不变的 vue 全家桶单独拆成 vendor chunk，浏览器可长缓存：
        // 业务代码更新时不用重新下载 vue/vue-router/pinia。
        // 刻意不拆 element-plus 和 echarts：二者都已按需引入 / dynamic import 懒加载，
        // 归到同一个 chunk 反而会把其它页面的组件或 3D 模块提前打进包、拖慢首屏。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia') || id.includes('node_modules/@vue')) return 'vue-vendor'
          return undefined
        }
      }
    }
  }
})
