// 敏感信息脱敏：输出侧与日志侧使用。
//
// 取舍：发给模型的原文不改（改了会影响解题与上下文），只在**回显给学生**和**落日志**时打码，
// 防止模型把学生输入的手机号、身份证、邮箱原样复述出去，被截图或转发带出本机。

const PATTERNS = [
  // 中国大陆手机号
  { key: 'phone', pattern: /1[3-9]\d{9}/g, mask: value => `${value.slice(0, 3)}****${value.slice(-4)}` },
  // 18 位身份证（末位可能是 X）
  { key: 'idCard', pattern: /\b\d{17}[\dXx]\b/g, mask: value => `${value.slice(0, 6)}********${value.slice(-4)}` },
  // 邮箱：保留首字母与域名
  { key: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mask: value => `${value[0]}***@${value.split('@')[1]}` },
  // 银行卡/长数字串（16-19 位），排除已按身份证处理的 18 位
  { key: 'bankCard', pattern: /\b\d{16}\b|\b\d{19}\b/g, mask: value => `****${value.slice(-4)}` }
]

/**
 * 对文本做脱敏。
 * @param {string} text
 * @returns {{ text: string, hits: Record<string, number> }}
 */
export function maskPii(text = '') {
  let output = String(text || '')
  const hits = {}
  for (const { key, pattern, mask } of PATTERNS) {
    pattern.lastIndex = 0
    output = output.replace(pattern, match => {
      hits[key] = (hits[key] || 0) + 1
      return mask(match)
    })
  }
  return { text: output, hits }
}

/** 是否含敏感信息（用于决定是否要在日志里整段打码）。 */
export function containsPii(text = '') {
  return Object.keys(maskPii(text).hits).length > 0
}
