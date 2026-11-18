<script setup>
// 补强建议：编号 + 标题 + 正文，按优先级排列。
defineProps({ items: { type: Array, default: () => [] } })
</script>

<template>
  <ol v-if="items.length" class="advice">
    <li v-for="(item, index) in items" :key="index" :data-tone="item.tone">
      <span class="n">{{ index + 1 }}</span>
      <div>
        <b>{{ item.title }}</b>
        <p>{{ item.body }}</p>
      </div>
    </li>
  </ol>
  <div v-else class="empty-block"><p>还没有可给的补强建议，先完成一次摸底或章节测试</p></div>
</template>

<style scoped>
.advice{list-style:none;margin:0;padding:13px 16px 15px;display:grid;gap:12px}
.advice li{display:grid;grid-template-columns:17px minmax(0,1fr);gap:10px}
.advice .n{font-size:11.5px;font-weight:600;color:#9fb2ac;line-height:1.55;font-variant-numeric:tabular-nums}
.advice b{display:block;font-size:13px;font-weight:600;margin-bottom:3px;line-height:1.5}
.advice p{margin:0;font-size:12px;line-height:1.7;color:var(--muted)}
.advice li[data-tone="primary"] b{color:var(--primary)}
.empty-block{padding:18px 16px;font-size:12.5px;color:var(--muted)}
.empty-block p{margin:0}
</style>
