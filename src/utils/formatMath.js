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
    // 服务端清洗过的文本再兜一层：全角点「．」在句末/中文后统一成中文句号（小数点 3．5 保留），
    // 因为/所以符号与后文之间补一个空格，保证真题、讲解、答疑等所有板块显示一致。
    .replace(/([\u4e00-\u9fa5])．(?=[\u4e00-\u9fa5]|$|\s)/g, '$1。')
    .replace(/．(?=$|\s)/g, '。')
    .replace(/([∵∴])[ \t]*(?=\S)/g, '$1 ')
    // PDF 转出来的题干常把「（  ）」拆成「（\n）」，直接渲染会在括号中间换行；
    // 先合并成一个用不换行空格撑开的括号组，保证空始终和左右括号在同一行。
    .replace(/[（(]\s*[\r\n]+\s*[）)]/g, '（\u00a0\u00a0）')
    .replace(/[（(][ \t]{1,6}[）)]/g, '（\u00a0\u00a0）')
    .replace(/\\{1,2}\(|\\{1,2}\)|\\{1,2}\[|\\{1,2}\]/g, '')
    .replace(/\\{2,}/g, '\n')
    .replace(/\\begin\{(?:aligned|array|cases)\}|\\end\{(?:aligned|array|cases)\}/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\quad/g, '  ')
    .replace(/\\,|\\;|\\ /g, ' ')
    .replace(/\\%/g, '%')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq|\\le(?![a-zA-Z])/g, '≤')
    .replace(/\\geq|\\ge(?![a-zA-Z])/g, '≥')
    .replace(/\\neq|\\ne(?![a-zA-Z])/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pm/g, '±')
    // 化学方程式箭头：\xrightarrow{点燃} 排成「—点燃→」，条件缺失时保留普通箭头。
    .replace(/\\xrightarrow\{([^{}]+)\}/g, '—$1→')
    .replace(/\\xrightarrow/g, '→')
    .replace(/\\uparrow/g, '↑')
    .replace(/\\downarrow/g, '↓')
    // 常用希腊字母与几何记号；题目和解析里出现时要显示真符号，不能漏出反斜杠命令。
    .replace(/\\rho/g, 'ρ')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\odot/g, '⊙')
    // 正余弦、正切按教材写法保留字母，去掉 LaTeX 命令反斜杠。
    .replace(/\\(sin|cos|tan)(?![a-zA-Z])/g, '$1')
    .replace(/\\sqrt\[3\]\{([^{}]+)\}/g, '∛($1)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    // 例题/解析里常见的几何与推理记号，教材里应显示成真实符号而不是反斜杠命令。
    .replace(/\\triangle/g, '△')
    .replace(/\\cong/g, '≌')
    .replace(/\\angle/g, '∠')
    .replace(/\\parallel/g, '∥')
    .replace(/\\perp/g, '⊥')
    .replace(/\\sim/g, '∽')
    .replace(/\\because/g, '∵')
    .replace(/\\therefore/g, '∴')
    .replace(/\^(?:\{)?\\circ(?:\})?/g, '°')
    .replace(/\\circ/g, '°')
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
  // 公式整条不拆行：把不含中文、带数学运算符的片段包成不可断行整体，
  // 行末放不下时整条移到下一行，避免等号或运算符被拆到两行。
  // 先把已生成的 HTML 标签寄存成占位符，防止正则把标签属性也当成公式内容。
  const tags = []
  const guarded = text.replace(/<[^>]+>/g, (tag) => {
    tags.push(tag)
    return `\u0003${tags.length - 1}\u0003`
  })
  text = guarded
    .replace(/[A-Za-z0-9\u0003\u00a0 °△≌∠∥⊥∽∵∴+\-−×÷·=<>≤≥≠±≈^_→()（）\[\]{}|√,.:/²³⁴]+/g, (run) => {
      // 超长片段不包，留给浏览器正常折行，避免撑出容器。
      if (run.length > 60) return run
      // 只处理真正的公式（至少一个运算符），英文句子不参与。
      if (!/[=+−×÷·≤≥≠±<>√≈^_∥⊥≌∽→]/.test(run)) return run
      const leading = run.match(/^\s*/)[0]
      const trailing = run.match(/\s*$/)[0]
      const core = run.slice(leading.length, run.length - trailing.length)
      if (!/[A-Za-z0-9\u0003]/.test(core)) return run
      // 英语填空题的题干常带下划线空格（如 "He ______ to school by bike every day."），
      // 整句套 nowrap 会在窄屏被横向裁掉；含多个英文单词的片段按自然语言处理，正常折行。
      const latinWords = core.match(/[A-Za-z]{2,}/g) || []
      if (latinWords.length >= 3 || (latinWords.length >= 2 && core.length > 32)) return run
      return `${leading}<span class="math-nowrap">${core}</span>${trailing}`
    })
    .replace(/\u0003(\d+)\u0003/g, (_, index) => tags[Number(index)])
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
