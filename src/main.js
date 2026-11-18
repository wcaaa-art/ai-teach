import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'
// 模板组件由 unplugin-vue-components 按需引入；这里只补命令式服务与 v-loading 的样式。
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/notification/style/css'
import './styles.css'
import './styles/report-print.css'
import App from './App.vue'
import router from './router/index.js'

const app = createApp(App)
app.config.errorHandler = (error, instance, info) => {
  console.error('页面出现可恢复错误：', error, info)
}
app.use(createPinia()).use(router).use(ElLoading).mount('#app')

// 开发环境的一次性数据迁移入口：控制台执行 __migrateMistakeSignals()，
// 传 { dryRun: true } 只预览不写库。生产构建不会包含这段。
if (import.meta.env.DEV) {
  import('./utils/migrateMistakeSignals.js').then(module => {
    window.__migrateMistakeSignals = module.migrateMistakeSignals
  })
}
