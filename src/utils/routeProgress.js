// 路由切换的全局进度状态。
// 页面组件是懒加载的，弱网下点导航会出现"没反应"的空档；这里只暴露一个布尔给外壳画顶部细条，
// 不侵入任何页面逻辑。
import { ref } from 'vue'

export const routeLoading = ref(false)
export const routeTargetTitle = ref('')

let safetyTimer = null

export function markRouteStart(to) {
  routeLoading.value = true
  routeTargetTitle.value = to?.meta?.title || ''
  // 兜底：导航异常时别让进度条永远挂着。
  clearTimeout(safetyTimer)
  safetyTimer = setTimeout(markRouteDone, 8000)
}

export function markRouteDone() {
  clearTimeout(safetyTimer)
  routeLoading.value = false
}
