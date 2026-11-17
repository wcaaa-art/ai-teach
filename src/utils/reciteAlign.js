// 背诵比对：语音识别出来的文字和原文不会逐字相同（漏字、同音字、口语停顿），
// 所以不能用全等判断。这里用最长公共子序列算覆盖率，并把「漏掉的那几段」找出来，
// 好在界面上精确提示用户卡在哪里。

// 归一化：去掉标点、空格和无关符号，统一小写，只留下用于比对的实词。
export function normalizeSpeech(text) {
  return String(text || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[，。、；：？！""''《》（）【】…—·,.;:?!"'()\[\]<>~`@#$%^&*+=|\\/-]/g, '')
    .toLowerCase()
}

// 最长公共子序列长度：纯函数，句子长度在 200 字以内，二维表足够快。
function lcsLength(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  const table = new Uint16Array(rows * cols)
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      table[i * cols + j] = a[i - 1] === b[j - 1]
        ? table[(i - 1) * cols + (j - 1)] + 1
        : Math.max(table[(i - 1) * cols + j], table[i * cols + (j - 1)])
    }
  }
  return table[(rows - 1) * cols + (cols - 1)]
}

// 回溯出原文里哪些位置被念到了，未命中的连续片段就是「漏掉的部分」。
function missedRanges(target, heard) {
  const rows = target.length + 1
  const cols = heard.length + 1
  const table = new Uint16Array(rows * cols)
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      table[i * cols + j] = target[i - 1] === heard[j - 1]
        ? table[(i - 1) * cols + (j - 1)] + 1
        : Math.max(table[(i - 1) * cols + j], table[i * cols + (j - 1)])
    }
  }
  const matched = new Set()
  let i = target.length
  let j = heard.length
  while (i > 0 && j > 0) {
    if (target[i - 1] === heard[j - 1]) { matched.add(i - 1); i -= 1; j -= 1 }
    else if (table[(i - 1) * cols + j] >= table[i * cols + (j - 1)]) i -= 1
    else j -= 1
  }
  const ranges = []
  let start = -1
  for (let k = 0; k < target.length; k += 1) {
    if (!matched.has(k)) { if (start === -1) start = k }
    else if (start !== -1) { ranges.push([start, k]); start = -1 }
  }
  if (start !== -1) ranges.push([start, target.length])
  return ranges
}

/**
 * 判断一句背得对不对。
 * @param {string} target 原文
 * @param {string} heard 识别到的文字
 * @param {number} threshold 覆盖率阈值，默认 0.72；短句漏一两个字仍算过
 * @returns {{ ok: boolean, rate: number, missed: string[] }}
 */
export function judgeLine(target, heard, threshold = 0.72) {
  const cleanTarget = normalizeSpeech(target)
  const cleanHeard = normalizeSpeech(heard)
  if (!cleanTarget) return { ok: true, rate: 1, missed: [] }
  if (!cleanHeard) return { ok: false, rate: 0, missed: [target] }
  const rate = lcsLength(cleanTarget, cleanHeard) / cleanTarget.length
  const missed = missedRanges(cleanTarget, cleanHeard).map(([start, end]) => cleanTarget.slice(start, end))
  return { ok: rate >= threshold, rate, missed }
}

// 卡住时给的提示：截取这句话的前几个字。给太多等于直接念答案，
// 所以默认只露 4 个字，用户点「再提示一点」才逐步加长。
export function buildHint(target, step = 0) {
  const clean = normalizeSpeech(target)
  if (!clean) return ''
  const length = Math.min(clean.length, 4 + step * 3)
  return clean.slice(0, length)
}

// 英语默写判定：忽略大小写和首尾空格，允许连字符与空格写法差异。
export function judgeSpelling(answer, input) {
  const clean = value => String(value || '').toLowerCase().replace(/[\s-]/g, '').trim()
  const target = clean(answer)
  const typed = clean(input)
  return { ok: Boolean(target) && target === typed, target, typed }
}
