<script setup>
import { computed } from 'vue'
import MasteryScale from './MasteryScale.vue'
import { describeMastery, UNTESTED_HINT } from '../../utils/chapterOutcomes.js'

// 掌握表：4 列；已测按掌握度升序在前，未测按教材顺序在后。
const props = defineProps({
  rows: { type: Array, default: () => [] },
  chapters: { type: Array, default: () => [] },
  wrongByChapter: { type: Object, default: () => ({}) }
})

const TONE_LABEL = { 0: '未掌握', 1: '薄弱', 2: '中等', 3: '稳固' }
const TONE_KEY = { 0: 'weak', 1: 'weak', 2: 'mid', 3: 'good' }

const tableRows = computed(() => {
  const tested = [...props.rows].sort((a, b) => a.mastery - b.mastery)
  const testedIds = new Set(tested.map(row => row.id))
  const untested = props.chapters.filter(chapter => !testedIds.has(chapter.id))
  return [
    ...tested.map(row => ({
      id: row.id,
      name: row.name,
      desc: describeMastery({
        chapterName: row.name,
        mastery: row.mastery,
        wrongCount: props.wrongByChapter[row.id]?.count || 0
      }),
      mastery: row.mastery,
      valueText: `${row.mastery}/3`,
      tone: TONE_LABEL[row.mastery] || '未掌握',
      toneKey: TONE_KEY[row.mastery] || 'weak',
      untested: false
    })),
    ...untested.map(chapter => ({
      id: chapter.id,
      name: chapter.name,
      desc: UNTESTED_HINT,
      mastery: 0,
      valueText: '未测',
      tone: '—',
      toneKey: 'none',
      untested: true
    }))
  ]
})
</script>

<template>
  <div class="mt-wrap">
    <table class="mt">
      <colgroup>
        <col style="width:210px" />
        <col />
        <col style="width:190px" />
        <col style="width:86px" />
      </colgroup>
      <thead>
        <tr><th>学习专题</th><th>掌握情况</th><th>掌握度</th><th>状态</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in tableRows" :key="row.id" :data-untested="row.untested || undefined">
          <td class="mt-name">{{ row.name }}</td>
          <td class="mt-desc">{{ row.desc }}</td>
          <td class="mt-track">
            <MasteryScale :value="row.mastery" :untested="row.untested" />
            <span class="mt-val">{{ row.valueText }}</span>
          </td>
          <td class="mt-status"><span class="st" :data-tone="row.toneKey">{{ row.tone }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.mt-wrap{overflow-x:auto}
.mt{width:100%;border-collapse:collapse;table-layout:fixed}
.mt th{padding:7px 16px;text-align:left;font-size:11px;font-weight:500;color:#9aaba6;letter-spacing:.04em;border-bottom:1px solid var(--border-soft,#eef4f1)}
.mt th:last-child{text-align:right;padding-right:18px}
.mt td{padding:8px 16px;height:42px;border-bottom:1px solid var(--border-soft,#eef4f1);vertical-align:middle}
.mt tr:last-child td{border-bottom:0}
/* 名称完整显示并允许折行，行首与「掌握情况」列保持同一条竖线对齐。 */
.mt-name{font-size:13px;font-weight:600;line-height:1.45;white-space:normal;word-break:break-word;padding-right:8px}
.mt-desc{font-size:12px;color:var(--muted);line-height:1.45;padding-right:20px;white-space:normal}
.mt-track{white-space:nowrap}
.mt-val{display:inline-block;min-width:30px;margin-left:8px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.mt-status{text-align:right;padding-right:18px;white-space:nowrap}
.st{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.st[data-tone="good"]{background:rgba(77,129,122,.12);color:#3d726e}
.st[data-tone="mid"]{background:rgba(134,171,159,.20);color:#4f7468}
.st[data-tone="weak"]{background:rgba(192,138,99,.15);color:#9c6c44}
.st[data-tone="none"]{background:none;color:#c9d6d1;font-weight:400}
@media(max-width:1040px){.mt-desc{display:none}}
@media(max-width:720px){
  /* 窄屏锁死的列宽会撑出横向滚动，改成自适应并让专题名折行 */
  .mt col{width:auto !important}
  .mt-name{white-space:normal;line-height:1.35}
  .mt-status{display:none}
}
</style>
