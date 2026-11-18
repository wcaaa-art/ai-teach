<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { logoutAccount } from '../services/api.js'
import DataBackupCard from '../components/DataBackupCard.vue'
import FeedbackDialog from '../components/FeedbackDialog.vue'
const router = useRouter(); const store=useAppStore();const baseUrl=import.meta.env.VITE_LLM_BASE_URL||'https://api.deepseek.com';const model=import.meta.env.VITE_LLM_MODEL_NAME||'deepseek-flash';const feedbackOpen=ref(false)
const loggingOut=ref(false)
async function update(key,value){await store.updateSettings({[key]:value})}
// 退出登录从顶部导航挪到设置页：先通知本机账号服务，再清空当前用户回到本地数据空间。
async function logout(){
  if(loggingOut.value) return
  loggingOut.value=true
  const result=await logoutAccount()
  loggingOut.value=false
  if(!result.success){ElMessage.error(result.error||'退出登录失败，请检查本机服务后重试');return}
  await store.clearUser()
  ElMessage.success('已退出登录')
  router.push('/home')
}
</script>
<template><div class="page"><div class="page-header"><div><h2 class="page-title">系统设置</h2><p class="page-subtitle">按你的设备和习惯，调整专注体验</p></div></div><div class="grid-2"><section class="surface surface-pad"><h3 class="section-title">体验开关</h3><div class="setting-row"><div><strong>摄像头监督默认状态</strong><p class="muted">专注页仍会再次展示隐私说明</p></div><el-switch :model-value="store.settings.cameraDefault" @change="value=>update('cameraDefault',value)"/></div><div class="setting-row"><div><strong>提醒音效</strong><p class="muted">视觉离岗时播放轻提示音</p></div><el-switch :model-value="store.settings.soundEnabled" @change="value=>update('soundEnabled',value)"/></div><div class="setting-row"><div><strong>AI 语音朗读</strong><p class="muted">答疑朗读、背单词自动发音</p></div><el-switch :model-value="store.settings.ttsEnabled" @change="value=>update('ttsEnabled',value)"/></div><div class="setting-row"><div><strong>深色主题</strong><p class="muted">降低夜间学习时的屏幕刺激</p></div><el-switch :model-value="store.settings.darkMode" @change="value=>update('darkMode',value)"/></div></section><section class="surface surface-pad"><h3 class="section-title">性能与连接</h3><div class="setting-row"><div><strong>低配模式</strong><p class="muted">关闭 MediaPipe 视觉推理，仅保留页面切标签检测</p></div><el-switch :model-value="store.settings.lowPerformance" @change="value=>update('lowPerformance',value)"/></div><el-divider/><p class="muted">LLM 接口（只读展示）</p><div class="readonly-item"><span>Base URL</span><code>{{baseUrl}}</code></div><div class="readonly-item"><span>模型名称</span><code>{{model}}</code></div><el-alert type="info" :closable="false" style="margin-top:16px">API 密钥仅存放在后端 .env，前端不会接触密钥</el-alert></section><section class="surface surface-pad"><h3 class="section-title">帮助与反馈</h3><div class="setting-row"><div><strong>意见反馈</strong><p class="muted">哪里不好用、哪里写错了、想要什么功能</p></div><el-button plain size="small" @click="feedbackOpen=true">写反馈</el-button></div></section><section class="surface surface-pad"><h3 class="section-title">账号</h3><div class="setting-row"><div><strong>{{ store.user ? (store.user.displayName || '已登录') : '本地模式' }}</strong><p class="muted">{{ store.user ? store.user.email : '未登录，学习数据只保存在这台设备上' }}</p></div><el-button v-if="store.user" plain size="small" :loading="loggingOut" @click="logout">退出登录</el-button><el-button v-else plain size="small" @click="router.push('/auth')">去登录</el-button></div></section><DataBackupCard/><FeedbackDialog v-model="feedbackOpen"/></div></div></template>
<style scoped>.setting-row{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:16px 0;border-bottom:1px solid var(--border)}.setting-row:last-child{border-bottom:0}.setting-row strong{font-size:calc(14px*var(--fs-scale))}.setting-row p{margin:5px 0 0;font-size:calc(12px*var(--fs-scale))}.readonly-item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;background:var(--surface-soft);margin:8px 0;border-radius:10px;font-size:calc(13px*var(--fs-scale))}.readonly-item code{color:var(--primary);word-break:break-all}@media (min-width:1180px){/* 宽屏排三列：四张卡从三行压成两行，设置页一屏就能看完 */.grid-2{grid-template-columns:repeat(3,minmax(0,1fr))}}</style>
