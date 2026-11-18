<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { makeId, saveFeedback } from '../db/index.js'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const route = useRoute()
const saving = ref(false)
const categories = ['功能建议', '使用问题', '内容纠错', '其他']
const form = ref({ category: categories[0], content: '', contact: '' })

// 每次打开都重置表单，避免上次残留内容被误提交。
watch(() => props.modelValue, value => {
  if (value) form.value = { category: categories[0], content: '', contact: '' }
})

async function submit() {
  const content = form.value.content.trim()
  if (!content) { ElMessage.warning('先写点内容再提交'); return }
  saving.value = true
  try {
    // 与专注页反馈共用 feedbacks 表；额外记录页面和分类，便于统一回看。
    await saveFeedback({
      id: makeId('feedback'), type: 'site', page: route.path, category: form.value.category,
      content, note: content, contact: form.value.contact.trim(),
      completion: null, mastery: null, createdAt: Date.now()
    })
    emit('update:modelValue', false)
    ElMessage.success('已收到，感谢反馈')
  } finally { saving.value = false }
}
</script>
<template>
  <el-dialog :model-value="modelValue" title="意见反馈" width="min(460px,94vw)" @update:model-value="emit('update:modelValue', $event)">
    <el-form label-position="top">
      <el-form-item label="类型"><el-select v-model="form.category"><el-option v-for="item in categories" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="具体内容"><el-input v-model="form.content" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="哪里不好用、哪里写错了、想要什么功能…" /></el-form-item>
      <el-form-item label="联系方式（可选）"><el-input v-model="form.contact" placeholder="邮箱或微信，方便回复你" maxlength="60" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">提交反馈</el-button>
    </template>
  </el-dialog>
</template>
