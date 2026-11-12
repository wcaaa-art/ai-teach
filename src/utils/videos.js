// 学习视频推荐：用「教材版本 + 年级 + 科目 + 章节」拼 B 站搜索直达链接。
// 不写死视频 id，避免 UP 主删稿或改标题后链接失效；搜索结果由 B 站实时给出。
export function bilibiliSearchUrl({ grade = '', subject = '', edition = '', chapter = '' } = {}) {
  const keyword = [edition, grade, subject, chapter, '同步课程'].filter(Boolean).join(' ')
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`
}

// 「换一换」最多 5 次，超过后引导用户直接去 B 站搜索，避免无限刷新。
export const VIDEO_SWAP_LIMIT = 5

// 换一换的原因：old 太旧、author 不喜欢这个老师、fast 讲得太快、edition 版本不对。
export const VIDEO_SWAP_REASONS = [
  { value: 'old', label: '太旧' },
  { value: 'author', label: '不喜欢这个老师' },
  { value: 'fast', label: '讲得太快' },
  { value: 'edition', label: '版本不对' }
]

export function remainingVideoSwaps(used = 0) {
  return Math.max(0, VIDEO_SWAP_LIMIT - (Number(used) || 0))
}

export const VIDEO_SWAP_LIMIT_TEXT = '已经换了 5 次，这个章节暂时没有更合适的讲解。建议直接去 B 站用关键词搜索，或先换个专题补基础。'

// 播放量按中文习惯缩写：1273484 → 127.3万，1.2亿 → 1.2亿。
export function formatPlayCount(value) {
  const count = Number(value) || 0
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`
  if (count >= 10000) {
    const wan = count / 10000
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)}万`
  }
  return String(count)
}

// 时长按秒数格式化：112 分钟 → 1小时52分，18 分钟 → 18分钟。
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (!total) return '时长未知'
  if (total < 60) return `${total}秒`
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours) return minutes ? `${hours}小时${minutes}分` : `${hours}小时`
  return `${minutes}分钟`
}
