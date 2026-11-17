// 计划类型判断：决定点开一条计划时，是进专注计时器，还是进背诵窗口。
// 规则只依赖「学科 + 名称里的关键词」，不需要额外的数据库字段，
// 老计划（没有 taskType）也能被正确识别，避免历史数据要重刷一遍。

// 强关键词：出现它们本身就说明这条计划要「记住一段内容」，与学科无关。
// 化学方程式默写、物理公式默写同样适用逐句比对，所以不设学科白名单。
const STRONG_TEXT = /背诵|背默|默写|记诵|朗读|古诗|古文|文言|课文|诗词/
// 弱关键词：只有文科才判定，避免「数学·要点归纳」这类练习被误抓。
const WEAK_TEXT = /要点|口诀/
const TEXT_SUBJECTS = ['语文', '历史', '道德与法治', '政治', '地理', '生物']
// 英语单词相关：先判听写，再判普通背单词，两个都会命中「单词」，顺序不能反。
const DICTATION_KEYWORDS = /听写|拼写|默单词|默词/
const WORD_KEYWORDS = /单词|词汇|生词|词组|word|vocab/i

/**
 * 判断一条计划应该打开哪种学习窗口。
 * @param {{ subject?: string, name?: string }} plan
 * @returns {{ mode: 'dictation'|'words'|'text'|null, reason: string }}
 */
export function detectReciteMode(plan) {
  const subject = String(plan?.subject || '').trim()
  const name = String(plan?.name || '').trim()
  if (!name) return { mode: null, reason: 'empty' }

  // 英语优先：同一条计划里「听写」比「单词」更具体，先命中听写。
  if (subject === '英语') {
    if (DICTATION_KEYWORDS.test(name)) return { mode: 'dictation', reason: '英语 + 听写' }
    if (WORD_KEYWORDS.test(name)) return { mode: 'words', reason: '英语 + 单词' }
    // 英语课文朗读也走逐句比对，只是语言是英文。
    if (/课文|朗读|背诵/.test(name)) return { mode: 'text', reason: '英语 + 课文' }
    return { mode: null, reason: '英语但非记忆类任务' }
  }

  if (STRONG_TEXT.test(name)) return { mode: 'text', reason: '记忆类任务' }
  if (TEXT_SUBJECTS.includes(subject) && WEAK_TEXT.test(name)) return { mode: 'text', reason: `${subject} + 记忆类任务` }
  return { mode: null, reason: '普通练习任务' }
}

// 计划行上挂的小标记：让用户悬停前就知道这条会打开什么。
export const RECITE_BADGES = {
  text: '背诵',
  words: '背单词',
  dictation: '打字默写'
}

export function reciteBadge(plan) {
  const { mode } = detectReciteMode(plan)
  return mode ? RECITE_BADGES[mode] : ''
}

// 背诵窗口标题上的模式名，界面上统一用这套说法。
export const RECITE_MODE_LABELS = {
  text: '逐句背诵',
  words: '快速背单词',
  dictation: '打字默写'
}
