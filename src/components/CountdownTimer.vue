<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ seconds: { type: Number, default: 1500 }, running: Boolean, plain: Boolean })
const emit = defineEmits(['tick', 'complete'])
const remaining = ref(props.seconds); let timer = null
watch(() => props.seconds, value => { if (!timer) remaining.value = value })
watch(() => props.running, value => value ? start() : stop(), { immediate: true })
function start(){ if (timer || remaining.value <= 0) return; timer = window.setInterval(() => { remaining.value -= 1; emit('tick', remaining.value); if (remaining.value <= 0) { stop(); emit('complete') } },1000) }
function stop(){ if(timer){clearInterval(timer);timer=null} }
function reset(value=props.seconds){ stop(); remaining.value=value }
const display = computed(() => { const min=Math.floor(remaining.value/60).toString().padStart(2,'0'); const sec=(remaining.value%60).toString().padStart(2,'0'); return `${min}:${sec}` })
const cells = computed(() => display.value.split('').map((char, index) => ({ key: index, colon: char === ':', value: char })))
defineExpose({ start, stop, reset, remaining })
onBeforeUnmount(stop)
</script>
<template>
  <div class="countdown" :class="{ 'is-plain': plain }">
    <div v-if="plain" class="plain-clock" role="timer" :aria-label="display">{{ display }}</div>
    <div v-else class="clock" role="timer" :aria-label="display">
      <template v-for="cell in cells" :key="cell.key">
        <span v-if="cell.colon" class="clock-colon">:</span>
        <span v-else class="clock-cell">
          <span class="clock-strip" :style="{ transform: `translateY(-${Number(cell.value) * 10}%)` }">
            <span v-for="digit in 10" :key="digit - 1">{{ digit - 1 }}</span>
          </span>
        </span>
      </template>
    </div>
    <div v-if="!plain" class="time-hint">{{ running ? '专注进行中 · 保持自己的节奏' : '准备好后，点击开始专注' }}</div>
  </div>
</template>
<style scoped>
.countdown{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;container-type:inline-size}
.countdown.is-plain{display:block;width:auto;container-type:normal}
.plain-clock{font-variant-numeric:tabular-nums;line-height:1}
.clock{display:flex;align-items:center;justify-content:center;gap:.08em;font-size:clamp(56px,10vw,190px);font-size:clamp(56px,26cqw,220px);font-weight:700;line-height:1;color:var(--primary);font-variant-numeric:tabular-nums}
.clock-cell{position:relative;display:block;width:.62em;height:1.2em;overflow:hidden;background:var(--surface-soft);border:1px solid var(--border);border-radius:.14em;box-shadow:inset 0 -.06em .14em rgba(0,0,0,.04)}
.clock-strip{display:block}
.clock-strip span{display:block;height:1.2em;line-height:1.2em;text-align:center}
.clock-colon{width:.26em;text-align:center;color:var(--primary);opacity:.75}
@media (prefers-reduced-motion: no-preference){
  .clock-strip{transition:transform .45s cubic-bezier(.25,.8,.35,1)}
}
</style>
