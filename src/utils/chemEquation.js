// 化学方程式的口头读法识别。
// 化学方程式的原文是符号（C + O₂ → CO₂），但学生口头背出来是中文
// （「碳加氧气点燃生成二氧化碳」「氧气加碳点燃生成二氧化碳」）。
// 这两种文本在字符层面几乎不重叠，用普通的 LCS 覆盖率判断必然判错。
//
// 解法：把符号方程式翻译成一套「口头读法」基准文本，再把学生识别到的
// 中文口语也归一化成同一套词元，然后比对词元覆盖。顺序不作为硬约束
// （「碳加氧气」和「氧气加碳」都算对），只要求关键物质、条件、产物齐全。

// 元素 / 物质 → 可读词元。口语里同一个东西有几种说法，都归到同一个 key。
const SYMBOL_MAP = [
  // 单质 / 元素
  ['C', ['碳', '炭']],
  ['O₂', ['氧气', '氧']],
  ['H₂', ['氢气', '氢']],
  ['N₂', ['氮气', '氮']],
  ['Cl₂', ['氯气', '氯']],
  ['P', ['磷', '红磷', '白磷']],
  ['S', ['硫', '硫磺']],
  ['Fe', ['铁']],
  ['Cu', ['铜']],
  ['Mg', ['镁']],
  ['Al', ['铝']],
  ['Zn', ['锌']],
  ['Na', ['钠']],
  ['K', ['钾']],
  ['Ca', ['钙']],
  ['Ag', ['银']],
  ['Hg', ['汞', '水银']],
  ['Si', ['硅']],
  // 氧化物 / 化合物
  ['CO₂', ['二氧化碳']],
  ['CO', ['一氧化碳']],
  ['H₂O', ['水']],
  ['H₂O₂', ['过氧化氢', '双氧水']],
  ['SO₂', ['二氧化硫']],
  ['SO₃', ['三氧化硫']],
  ['NO₂', ['二氧化氮']],
  ['P₂O₅', ['五氧化二磷']],
  ['Fe₃O₄', ['四氧化三铁']],
  ['Fe₂O₃', ['氧化铁', '三氧化二铁']],
  ['FeO', ['氧化亚铁']],
  ['CuO', ['氧化铜']],
  ['Cu₂O', ['氧化亚铜']],
  ['MgO', ['氧化镁']],
  ['Al₂O₃', ['氧化铝']],
  ['CaO', ['氧化钙', '生石灰']],
  ['Na₂O', ['氧化钠']],
  ['K₂O', ['氧化钾']],
  ['ZnO', ['氧化锌']],
  // 酸 / 碱 / 盐
  ['HCl', ['盐酸']],
  ['H₂SO₄', ['硫酸']],
  ['HNO₃', ['硝酸']],
  ['H₂CO₃', ['碳酸']],
  ['H₃PO₄', ['磷酸']],
  ['NaOH', ['氢氧化钠', '烧碱', '火碱', '苛性钠']],
  ['KOH', ['氢氧化钾']],
  ['Ca(OH)₂', ['氢氧化钙', '熟石灰', '消石灰', '石灰水']],
  ['Ba(OH)₂', ['氢氧化钡']],
  ['Mg(OH)₂', ['氢氧化镁']],
  ['Al(OH)₃', ['氢氧化铝']],
  ['Fe(OH)₃', ['氢氧化铁']],
  ['Fe(OH)₂', ['氢氧化亚铁']],
  ['Cu(OH)₂', ['氢氧化铜']],
  ['NaCl', ['氯化钠', '食盐']],
  ['KCl', ['氯化钾']],
  ['CaCl₂', ['氯化钙']],
  ['MgCl₂', ['氯化镁']],
  ['AlCl₃', ['氯化铝']],
  ['FeCl₃', ['氯化铁']],
  ['FeCl₂', ['氯化亚铁']],
  ['CuCl₂', ['氯化铜']],
  ['ZnCl₂', ['氯化锌']],
  ['BaCl₂', ['氯化钡']],
  ['AgCl', ['氯化银']],
  ['NaBr', ['溴化钠']],
  ['KBr', ['溴化钾']],
  ['NaI', ['碘化钠']],
  ['KI', ['碘化钾']],
  ['Na₂CO₃', ['碳酸钠', '纯碱', '苏打']],
  ['NaHCO₃', ['碳酸氢钠', '小苏打']],
  ['CaCO₃', ['碳酸钙', '石灰石']],
  ['K₂CO₃', ['碳酸钾']],
  ['BaCO₃', ['碳酸钡']],
  ['MgCO₃', ['碳酸镁']],
  ['Na₂SO₄', ['硫酸钠']],
  ['K₂SO₄', ['硫酸钾']],
  ['CuSO₄', ['硫酸铜']],
  ['FeSO₄', ['硫酸亚铁']],
  ['Fe₂(SO₄)₃', ['硫酸铁']],
  ['ZnSO₄', ['硫酸锌']],
  ['MgSO₄', ['硫酸镁']],
  ['Al₂(SO₄)₃', ['硫酸铝']],
  ['BaSO₄', ['硫酸钡']],
  ['CaSO₄', ['硫酸钙']],
  ['AgNO₃', ['硝酸银']],
  ['KNO₃', ['硝酸钾']],
  ['NaNO₃', ['硝酸钠']],
  ['NH₄NO₃', ['硝酸铵']],
  ['Cu(NO₃)₂', ['硝酸铜']],
  ['NH₃', ['氨气', '氨']],
  ['NH₄Cl', ['氯化铵']],
  ['CH₄', ['甲烷']],
  ['C₂H₅OH', ['乙醇', '酒精']],
  ['KMnO₄', ['高锰酸钾']],
  ['K₂MnO₄', ['锰酸钾']],
  ['KClO₃', ['氯酸钾']],
  ['MnO₂', ['二氧化锰']],
  ['H₂S', ['硫化氢']],
  ['Na₂O₂', ['过氧化钠']],
  ['Cu₂(OH)₂CO₃', ['碱式碳酸铜', '铜绿']],
  ['KAl(SO₄)₂', ['明矾']],
  ['Al₂O₃·2SiO₂·2H₂O', ['高岭土']]
]

// 反应条件 / 连接词 → 词元。这些词在比对时也参与，但属于「加分项」而非硬性缺项。
const CONDITION_MAP = [
  ['点燃', ['点燃']],
  ['加热', ['加热']],
  ['高温', ['高温']],
  ['通电', ['通电', '电解']],
  ['催化剂', ['催化剂']],
  ['MnO₂', ['二氧化锰', '催化剂']],
  ['光照', ['光照', '光']]
]

const PLUS_WORDS = ['加', '和', '与', '跟', '再加上', '还有']
const ARROW_WORDS = ['生成', '得到', '变成', '产生', '生成物是', '反应生成']

// 下标数字转普通数字（₂ → 2），方便口语「o2」「co2」这种说法也能对上。
function flattenSubscript(s) {
  return String(s || '')
    .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2')
    .replace(/₃/g, '3').replace(/₄/g, '4').replace(/₅/g, '5')
    .replace(/₆/g, '6').replace(/₇/g, '7').replace(/₈/g, '8').replace(/₉/g, '9')
}

// ASR 同音错字容错：whisper 等中文识别对部分化学名词容易写成同音错字，
// 把这些常见错写也归并到正确的读法词上，避免「氧气」被识别成「养气」就整句判错。
// 只收高置信度的常见错写，不收会引入歧义的（如「水」不加「谁」，否则会和疑问句撞车）。
const HOMOPHONE_VARIANTS = {
  '氧气': ['养气', '洋气'],
  '氢气': ['清气', '轻气'],
  '二氧化碳': ['二养化碳', '二氧化炭'],
  '一氧化碳': ['一养化碳'],
  '二氧化硫': ['二养化硫'],
  '点燃': ['点染', '点然'],
  '生成': ['声成', '生呈'],
  '盐酸': ['延酸'],
  '硫酸': ['留酸'],
  '碳酸钙': ['炭酸钙', '碳酸盖'],
  '水': ['谁']
}

// 词元归一化：把一句话里的物质词、条件词提取成一串 key（保留出现顺序，去重）。
// 返回 { tokens: string[], kind: 'equation' | 'plain' }。
// 若一句话里几乎没有化学符号/中文读法词，就返回空 tokens，表示不是化学方程式。
function tokenizeSpokenText(text) {
  const raw = String(text || '').trim()
  if (!raw) return { tokens: [], kind: 'plain' }
  // 先把同音错字纠正回标准写法，再做后续匹配
  let s = flattenSubscript(raw)
  for (const [correct, wrongs] of Object.entries(HOMOPHONE_VARIANTS)) {
    for (const w of wrongs) {
      s = s.split(w).join(correct)
    }
  }
  const tokens = []
  // 候选词：符号本身 + 中文读法（含别名），长词优先，避免「二氧化碳」被「碳」误拆。
  const readables = []
  const symbolKeys = SYMBOL_MAP.map(([symbol]) => symbol)
  const condKeys = CONDITION_MAP.map(([cond]) => cond)
  for (const sym of symbolKeys) {
    readables.push([flattenSubscript(sym), sym])
  }
  for (const sym of condKeys) {
    readables.push([flattenSubscript(sym), sym])
  }
  for (const [symbol, names] of SYMBOL_MAP) {
    for (const n of names) readables.push([n, symbol])
  }
  for (const [cond, names] of CONDITION_MAP) {
    for (const n of names) readables.push([n, cond])
  }
  // 长词优先，保证「二氧化碳」先于「氧」「碳」匹配
  readables.sort((a, b) => b[0].length - a[0].length)

  let i = 0
  while (i < s.length) {
    let matched = false
    for (const [name, symbol] of readables) {
      if (s.startsWith(name, i)) {
        tokens.push(symbol)
        i += name.length
        matched = true
        break
      }
    }
    if (!matched) { i += 1 }
  }

  // 是否真的像化学方程式：至少命中 2 个物质/条件词元才算
  const kind = tokens.length >= 2 ? 'equation' : 'plain'
  return { tokens: [...new Set(tokens)], kind }
}

// 把符号方程式原文转成「标准口头读法」基准：用于和学生口语比对。
// 例如 "C + O₂（点燃）→ CO₂" → 词元序列 [C, O₂, 点燃, CO₂]。
// 注意：原文是符号（C、O2、CO2），学生口语是中文（碳、氧气、二氧化碳），
// 两套词都要能识别，并归并到同一个 symbol key。
function equationTokens(target) {
  const raw = String(target || '').trim()
  if (!raw) return []
  const s = flattenSubscript(raw)
  // 候选词：符号本身（按长度降序）+ 中文读法（含别名，按长度降序）。
  // 符号候选要把下标也补一份（C + O2 → 也要认 O₂ 的 symbol key 是 O₂）。
  const candidates = []
  const symbolKeys = SYMBOL_MAP.map(([symbol]) => symbol)
  const condKeys = CONDITION_MAP.map(([cond]) => cond)
  for (const sym of symbolKeys) {
    const flat = flattenSubscript(sym)
    // 用 flatten 后的符号去匹配原文的 flatten 串
    candidates.push([flat, sym])
  }
  for (const sym of condKeys) {
    candidates.push([flattenSubscript(sym), sym])
  }
  for (const [symbol, names] of SYMBOL_MAP) {
    for (const n of names) candidates.push([n, symbol])
  }
  for (const [cond, names] of CONDITION_MAP) {
    for (const n of names) candidates.push([n, cond])
  }
  // 长词优先：CO2 先于 C、O2；二氧化碳先于氧、碳
  candidates.sort((a, b) => b[0].length - a[0].length)

  const tokens = []
  let i = 0
  while (i < s.length) {
    let matched = false
    for (const [name, symbol] of candidates) {
      if (s.startsWith(name, i)) {
        tokens.push(symbol)
        i += name.length
        matched = true
        break
      }
    }
    if (!matched) { i += 1 }
  }
  return [...new Set(tokens)]
}

// 判断原文是不是化学方程式：出现箭头 / 等号 + 至少两个化学物质。
export function isChemicalEquation(target) {
  const raw = String(target || '').trim()
  if (!raw) return false
  if (!/[→=＝⟶⇒]/.test(raw)) return false
  return equationTokens(raw).length >= 2
}

// 化学方程式的背诵判定。
// @param {string} target 原文（符号写法）
// @param {string} heard 语音识别到的中文口语
// @returns {{ ok: boolean, rate: number, missed: string[] }}
export function judgeChemicalEquation(target, heard) {
  const targetTokens = equationTokens(target)
  const heardResult = tokenizeSpokenText(heard)
  if (!targetTokens.length) return { ok: false, rate: 0, missed: [target] }
  if (!heardResult.tokens.length) return { ok: false, rate: 0, missed: ['没听清说了什么'] }
  // 用集合覆盖：物质/条件是否说全了，顺序不作为硬约束（「氧气加碳」和「碳加氧气」都算对）。
  // 化学方程式读法里顺序确实无所谓，LCS 顺序比对会误伤这种正常读法。
  const hit = targetTokens.filter(t => heardResult.tokens.includes(t)).length
  const rate = hit / targetTokens.length
  // 缺失的词元（按原文顺序），用于界面提示「还差什么」。
  const missed = targetTokens.filter(t => !heardResult.tokens.includes(t))
  return { ok: rate >= 0.8, rate, missed }
}

// 把缺失的符号词元翻译回可读提示，例如 ["CO₂"] → ["二氧化碳"]。
export function describeMissedTokens(tokens) {
  const nameBySymbol = {}
  for (const [symbol, names] of SYMBOL_MAP) nameBySymbol[symbol] = names[0]
  for (const [cond, names] of CONDITION_MAP) nameBySymbol[cond] = names[0]
  return (tokens || []).map(t => nameBySymbol[t] || t)
}

// 把符号方程式转成一句完整的口语描述，用于「这句话是什么实验、生成了什么」的提示。
// 例如 "C + O₂（点燃）→ CO₂" → "碳和氧气，点燃，生成二氧化碳"。
export function describeEquation(target) {
  const raw = String(target || '').trim()
  if (!raw) return ''
  const arrowMatch = raw.match(/[→=＝⟶⇒]/)
  if (!arrowMatch) return ''
  const leftRaw = raw.slice(0, arrowMatch.index)
  const rightRaw = raw.slice(arrowMatch.index + arrowMatch[0].length)

  const nameBySymbol = {}
  for (const [symbol, names] of SYMBOL_MAP) nameBySymbol[symbol] = names[0]
  const condNameByKey = {}
  for (const [cond, names] of CONDITION_MAP) condNameByKey[cond] = names[0]

  // 物质：只从 SYMBOL_MAP 里取（排除 MnO₂ 这种既是物质又常当催化剂的，这里归物质）。
  // 条件：只从 CONDITION_MAP 里取，且排除与物质符号撞车的（MnO₂ 当条件时叫「二氧化锰」）。
  const symbolsOnly = tokens => tokens.filter(t => SYMBOL_MAP.some(([s]) => s === t))
  const condsOnly = tokens => tokens.filter(t => CONDITION_MAP.some(([c]) => c === t))

  const leftSubstances = symbolsOnly(equationTokens(leftRaw)).map(t => nameBySymbol[t]).filter(Boolean)
  const rightSubstances = symbolsOnly(equationTokens(rightRaw)).map(t => nameBySymbol[t]).filter(Boolean)
  // 条件：优先从括号里取（「（点燃）」「(MnO₂、Δ)」），没有括号再从全句里找条件词。
  const condRaw = raw.match(/[（(]([^（）()]*)[）)]/)
  const condTokens = condRaw
    ? condsOnly(equationTokens(condRaw[1]))
    : condsOnly(equationTokens(raw))
  // 条件的读法：把「MnO₂」这类催化剂符号统一说成「催化剂」，更贴合学生口语。
  const condNames = condTokens.map(t => (t === 'MnO₂' ? '催化剂' : condNameByKey[t])).filter(Boolean)

  if (!leftSubstances.length && !rightSubstances.length) return raw

  const parts = []
  if (leftSubstances.length) parts.push(leftSubstances.join('和'))
  if (condNames.length) parts.push(condNames.join('、'))
  if (rightSubstances.length) parts.push(`生成${rightSubstances.join('和')}`)
  return parts.join('，')
}

// 常见化学实验的「名称 + 现象」：用于背诵时提示「这是什么实验」。
// effect 只写可观察的实验现象（颜色、火焰、沉淀、气体、气味、光、热），
// 不写配平系数、化学式符号、催化剂位置等「书写细节」——那些不该在提示里出现。
const EXPERIMENTS = [
  { test: /C\s*\+\s*O₂.*CO₂/, name: '碳在氧气中燃烧', effect: '发出白光，生成使石灰水变浑浊的气体' },
  { test: /S\s*\+\s*O₂.*SO₂/, name: '硫在氧气中燃烧', effect: '蓝紫色火焰，生成有刺激性气味的气体' },
  { test: /4?P\s*\+\s*\d*O₂.*P₂O₅/, name: '红磷在氧气中燃烧', effect: '产生大量白烟，放出热量' },
  { test: /Fe\s*\+\s*\d*O₂.*Fe₃O₄/, name: '铁丝在氧气中燃烧', effect: '火星四射，生成黑色固体' },
  { test: /Mg\s*\+\s*O₂.*MgO/, name: '镁在空气中燃烧', effect: '发出耀眼白光，生成白色固体，放出大量热' },
  { test: /H₂\s*\+\s*O₂.*H₂O/, name: '氢气在氧气中燃烧', effect: '淡蓝色火焰，罩在火焰上方的烧杯壁出现水珠' },
  { test: /2?H₂O.*H₂.*O₂|H₂O.*电解|电解.*H₂O/, name: '电解水', effect: '正极产生使带火星木条复燃的气体，负极产生能燃烧的气体，体积比 1:2' },
  { test: /KClO₃/, name: '加热氯酸钾制取氧气', effect: '加热氯酸钾，生成的氧气能使带火星木条复燃' },
  { test: /KMnO₄/, name: '加热高锰酸钾制取氧气', effect: '试管口要塞棉花，生成的氧气能使带火星木条复燃' },
  { test: /H₂O₂/, name: '过氧化氢分解制氧', effect: '产生大量气泡，生成的氧气能使带火星木条复燃' },
  { test: /CaCO₃.*HCl|HCl.*CaCO₃/, name: '碳酸钙与稀盐酸反应', effect: '产生大量气泡，生成能使澄清石灰水变浑浊的气体' },
  { test: /Fe.*CuSO₄|CuSO₄.*Fe/, name: '铁与硫酸铜反应', effect: '铁表面析出红色物质，蓝色溶液逐渐变浅' },
  { test: /Zn.*HCl|HCl.*Zn/, name: '锌与稀盐酸反应', effect: '产生大量气泡，放热' },
  { test: /Fe.*HCl|HCl.*Fe/, name: '铁与稀盐酸反应', effect: '产生气泡，溶液由无色变为浅绿色' },
  { test: /NaOH.*HCl|HCl.*NaOH/, name: '中和反应', effect: '无明显现象，但反应会放热' },
  { test: /CO₂.*Ca\(OH\)₂|Ca\(OH\)₂.*CO₂/, name: '二氧化碳与澄清石灰水', effect: '澄清石灰水变浑浊，生成白色沉淀' },
  { test: /CaCO₃.*高温|高温.*CaCO₃/, name: '碳酸钙高温分解', effect: '高温煅烧石灰石，生成白色固体（生石灰）' },
  { test: /CuO.*C|C.*CuO/, name: '木炭还原氧化铜', effect: '黑色固体逐渐变红，生成能使石灰水变浑浊的气体' },
  { test: /H₂.*CuO|CuO.*H₂/, name: '氢气还原氧化铜', effect: '黑色固体逐渐变红，试管口出现水珠' },
  { test: /CO.*CuO|CuO.*CO/, name: '一氧化碳还原氧化铜', effect: '黑色固体逐渐变红，尾气有刺激性' }
]

// 生成「这是什么实验」的提示：找到匹配的实验就返回「实验名：现象」，
// 找不到就退回 describeEquation 的口语读法。
export function describeExperiment(target) {
  const raw = String(target || '').trim()
  if (!raw) return ''
  const hit = EXPERIMENTS.find(e => e.test.test(raw))
  if (hit) return `${hit.name}——${hit.effect}`
  return describeEquation(raw)
}

// 把学生打的口语（「碳加氧气点燃生成二氧化碳」）翻译回化学式符号写法，
// 用于打字默写提交后的三栏对比（用户中文 → 系统化学式 → 正确原式）。
// 不是精确还原（口语顺序、配平系数无法可靠反推），只求「能对上号」，
// 让用户一眼看出自己把哪些物质、条件、生成物说全/说漏了。
export function spokenToEquation(spoken) {
  const raw = String(spoken || '').trim()
  if (!raw) return ''
  const s = flattenSubscript(raw)
  // 先纠正同音错字
  let fixed = s
  for (const [correct, wrongs] of Object.entries(HOMOPHONE_VARIANTS)) {
    for (const w of wrongs) fixed = fixed.split(w).join(correct)
  }

  const nameBySymbol = {}
  for (const [symbol, names] of SYMBOL_MAP) nameBySymbol[symbol] = names[0]

  // 找出「生成/得到/变成」等箭头词的位置，切分反应物和生成物。
  const arrowIdx = (() => {
    for (const w of ARROW_WORDS) { const i = fixed.indexOf(w); if (i >= 0) return i }
    return -1
  })()
  const leftPart = arrowIdx >= 0 ? fixed.slice(0, arrowIdx) : fixed
  const rightPart = arrowIdx >= 0 ? fixed.slice(arrowIdx) : ''

  // 扫描一段文字里的物质符号（按出现顺序），条件词单独收集。
  const scanSubstances = seg => {
    const readables = []
    for (const [symbol, names] of SYMBOL_MAP) for (const n of names) readables.push([n, symbol])
    readables.sort((a, b) => b[0].length - a[0].length)
    const out = []
    let i = 0
    while (i < seg.length) {
      let hit = false
      for (const [name, symbol] of readables) {
        if (seg.startsWith(name, i)) { out.push(symbol); i += name.length; hit = true; break }
      }
      if (!hit) i += 1
    }
    return out
  }
  const scanConds = seg => {
    const readables = []
    for (const [cond, names] of CONDITION_MAP) for (const n of names) readables.push([n, cond])
    readables.sort((a, b) => b[0].length - a[0].length)
    const out = []
    let i = 0
    while (i < seg.length) {
      let hit = false
      for (const [name, cond] of readables) {
        if (seg.startsWith(name, i)) { out.push(cond); i += name.length; hit = true; break }
      }
      if (!hit) i += 1
    }
    return out
  }

  const left = scanSubstances(leftPart)
  const right = scanSubstances(rightPart)
  const conds = scanConds(fixed)

  if (!left.length && !right.length) return raw

  const condText = conds.length ? conds.map(c => (c === 'MnO₂' ? 'MnO₂' : nameBySymbol[c] || c)).join('、') : ''
  const condPart = condText ? `（${condText}）` : ''
  // 条件放在箭头上方（紧跟箭头后），符合化学书写习惯
  const leftStr = left.join(' + ')
  const rightStr = right.join(' + ')
  if (!rightStr) return condPart ? `${leftStr} →${condPart}` : leftStr
  return `${leftStr} ${condPart}→ ${rightStr}`.replace(/  +/g, ' ')
}
