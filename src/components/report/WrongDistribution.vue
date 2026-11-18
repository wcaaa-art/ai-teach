<script setup>
// 错题分布：本次作答错题按「章节 + 知识点」聚合，按错数降序。
defineProps({
  items: { type: Array, default: () => [] },
  total: { type: Number, default: 0 }
})
</script>

<template>
  <div v-if="items.length" class="wrong-wrap">
    <table class="mt mt-wrong">
      <colgroup>
        <col style="width:262px" /><col style="width:110px" /><col style="width:104px" /><col />
      </colgroup>
      <thead>
        <tr><th>知识点 / 题型</th><th>错题数</th><th>题号</th><th>这道题在考什么</th></tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.key">
          <td class="mt-name">{{ item.label }}</td>
          <td><span class="wrong-count">{{ item.count }} 题<span v-if="item.isTop" class="most">最多</span></span></td>
          <td class="mt-no">{{ item.questionText }}</td>
          <td class="mt-reason">{{ item.focusPoint }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-block">
    <p>本次没有可统计的错题</p>
    <p v-if="total === 0">题目均为学习状态自评，不产生对错数据，要做一次章节测试（5–8 题）才能拿到错题分布</p>
  </div>
</template>

<style scoped>
.wrong-wrap{overflow-x:auto}
.mt{width:100%;border-collapse:collapse;table-layout:fixed}
.mt th{padding:7px 16px;text-align:left;font-size:11px;font-weight:500;color:#9aaba6;letter-spacing:.04em;border-bottom:1px solid var(--border-soft,#eef4f1)}
.mt td{padding:8px 16px;border-bottom:1px solid var(--border-soft,#eef4f1);vertical-align:middle}
.mt tr:last-child td{border-bottom:0}
.mt-name{font-size:13px;font-weight:600;line-height:1.45;white-space:normal}
.wrong-count{font-size:12.5px;font-weight:600;color:#a8613f;white-space:nowrap}
.wrong-count .most{margin-left:6px;padding:0 6px;border-radius:5px;background:rgba(192,138,99,.16);color:#8f6240;font-size:10.5px;font-weight:600}
.mt-no{font-size:11.5px;color:var(--faint,#7f938d);white-space:nowrap;font-variant-numeric:tabular-nums}
.mt-reason{font-size:12px;color:var(--muted);line-height:1.5}
.empty-block{padding:18px 16px;font-size:12.5px;color:var(--muted);line-height:1.7}
.empty-block p{margin:0 0 6px}
.empty-block p:last-child{margin-bottom:0}
@media(max-width:720px){
  .mt th:nth-child(3),.mt td:nth-child(3){display:none}
  .mt col{width:auto !important}
  .mt-name{font-size:12.5px}
}
</style>
