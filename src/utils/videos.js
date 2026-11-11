// 学习视频推荐：用「教材版本 + 年级 + 科目 + 章节」拼 B 站搜索直达链接。
// 不写死视频 id，避免 UP 主删稿或改标题后链接失效；搜索结果由 B 站实时给出。
export function bilibiliSearchUrl({ grade = '', subject = '', edition = '', chapter = '' } = {}) {
  const keyword = [edition, grade, subject, chapter, '同步课程'].filter(Boolean).join(' ')
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`
}
