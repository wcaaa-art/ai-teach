import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles.css'
import App from './App.vue'
import router from './router/index.js'

const app = createApp(App)
app.config.errorHandler = (error, instance, info) => {
  console.error('页面出现可恢复错误：', error, info)
}
app.use(createPinia()).use(router).use(ElementPlus).mount('#app')
