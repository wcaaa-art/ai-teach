// @ts-check
// 将答疑中的常见 LaTeX/Markdown 数学写法转换为浏览器原生可读的教学排版。
// 先处理转义反斜杠和上下标，再保留普通文本换行；不执行任何用户输入 HTML。
/**
 * @param {string} [value]
 * @returns {string}
 */
export function formatMathText(value = '') {
  /** @type {Array<[string, string]>} */
  const fractions = []
  let text = String(value)
    .replace(/\\{1,2}\(|\\{1,2}\)|\\{1,2}\[|\\{1,2}\]/g, '')
    .replace(/\\{2,}/g, '\n')
    .replace(/\\begin\{(?:aligned|array)\}|\\end\{(?:aligned|array)\}/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\quad/g, '  ')
    .replace(/\\,|\\;/g, ' ')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => { const token = `\u0000${fractions.length}\u0000`; fractions.push([numerator, denominator]); return token })
    .replace(/\bfrac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => { const token = `\u0000${fractions.length}\u0000`; fractions.push([numerator, denominator]); return token })
    .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
    // 先转义普通文本，防止 v-html 把用户内容当作标签执行；公式标签由后续规则生成。
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 向量记号：\vec{a}、\overrightarrow{AB} 统一排成带上箭头的符号，模写作 |\vec{a}|。
    .replace(/\\vec\{([^{}]+)\}/g, '<span class="vec">$1</span>')
    .replace(/\\overrightarrow\{([^{}]+)\}/g, '<span class="vec">$1</span>')
    .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>')
    .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
    // 无花括号下标：字母取单个（a_n、S_n），数字整体取（a_10），避免 a_n+S_n 被并成一段。
    .replace(/_([A-Za-z]|\d+)/g, '<sub>$1</sub>')
    // 数列记号里常见的紧贴数字写法 a1、S1：只匹配独立的“字母+1~2位数字”记号，
    // 前后紧邻字母/数字时不转换（避免把 IPv6、B2B 等词拆开）。
    .replace(/(?<![A-Za-z0-9])([A-Za-z])(\d{1,2})(?![A-Za-z0-9])/g, '$1<sub>$2</sub>')
  fractions.forEach(([numerator, denominator], index) => {
    const token = `\u0000${index}\u0000`
    const safeNumerator = String(numerator).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safeDenominator = String(denominator).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    text = text.replace(token, `<span class="math-frac"><span>${safeNumerator}</span><span>${safeDenominator}</span></span>`)
  })
  return text
    .split('\n')
    .map(line => {
      if (!line.trim()) return '<br>'
      return decorateSequenceWords(line)
    })
    .join('<br>')
}

// 竖排的 an 只在明确数列语境（本行出现“数列”、已有显式下标如 a_n/S_n、或 S n 记号）时才转成下标；
// 用前后字符边界保护 and / than / 答案 等词，不做全局替换。
/**
 * @param {string} [line]
 * @returns {string}
 */
function decorateSequenceWords(line = '') {
  if (!/数列|<sub>|\bS\s?n\b/.test(line)) return line
  return line
    .replace(/(?<![A-Za-z0-9<>/])an(?![A-Za-z0-9<>/])/g, 'a<sub>n</sub>')
    // 数列语境下 Sn / S n 同样排成 Sₙ，不能只改 aₙ 而漏掉前 n 项和记号。
    .replace(/(?<![A-Za-z0-9<>/])([Ss])\s?n(?![A-Za-z0-9<>/])/g, '$1<sub>n</sub>')
}
