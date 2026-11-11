const reminderTimers = new Map()
const MAX_TIMEOUT = 2147480000

// 使用模块级定时器表，路由来回切换时不会为同一计划重复通知。
export function clearTaskReminder(planId) {
  const timer = reminderTimers.get(planId)
  if (timer) clearTimeout(timer)
  reminderTimers.delete(planId)
}

export function scheduleTaskReminder(plan) {
  clearTaskReminder(plan.id)
  if (!('Notification' in window) || Notification.permission !== 'granted' || !plan.remindAt || plan.status === 'archived') return

  const scheduleNextCheck = () => {
    const delay = plan.remindAt - Date.now()
    const timer = setTimeout(() => {
      if (plan.remindAt > Date.now()) {
        scheduleNextCheck()
        return
      }
      try { new Notification('Ai学习小伙伴', { body: `该开始「${plan.name}」啦` }) } catch (error) { console.warn('浏览器通知暂不可用。', error) }
      reminderTimers.delete(plan.id)
    }, Math.max(0, Math.min(delay, MAX_TIMEOUT)))
    reminderTimers.set(plan.id, timer)
  }
  scheduleNextCheck()
}
