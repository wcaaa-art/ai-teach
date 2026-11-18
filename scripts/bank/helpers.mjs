// 题库生成公共工具：把「正确答案 + 干扰项」组装成四选一单选题。
// 答案由生成器里的算式直接算出，选项只做旋转不打乱语义，保证解析与 correctIndex 永远一致。
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

// 统一转成展示文本：数字保留 6 位小数，避免 0.30000000000000004 这类浮点噪声进入题干。
function optionText(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`选项不是有效数字：${value}`)
    return String(Number(value.toFixed(6)))
  }
  return String(value ?? '').trim()
}

export function makeQuestion({
  stem,
  correct,
  wrongs = [],
  hint = '',
  difficulty = 1,
  dimension = 'concept',
  seed = 0
}) {
  const correctText = optionText(correct)
  if (!correctText) throw new Error(`缺少正确答案：${stem}`)
  const seen = new Set([correctText])
  const distractors = []
  for (const item of wrongs) {
    const text = optionText(item)
    if (!text || seen.has(text)) continue
    seen.add(text)
    distractors.push(text)
    if (distractors.length === 3) break
  }
  // 干扰项不够时，数值题用相邻整数补齐；非数值题直接报错，避免写出重复选项的低质量题。
  if (distractors.length < 3) {
    const numeric = Number(correctText)
    if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(correctText)) {
      for (const delta of [1, -1, 2, -2, 3, -3]) {
        if (distractors.length >= 3) break
        const text = optionText(numeric + delta)
        if (seen.has(text)) continue
        seen.add(text)
        distractors.push(text)
      }
    }
  }
  if (distractors.length < 3) throw new Error(`干扰项不足 3 个：${stem}`)
  const options = [correctText, ...distractors]
  const offset = ((Math.trunc(Number(seed) || 0) % 4) + 4) % 4
  const rotated = [...options.slice(offset), ...options.slice(0, offset)]
  const correctIndex = rotated.indexOf(correctText)
  if (correctIndex < 0) throw new Error(`选项旋转后丢失正确答案：${stem}`)
  return {
    type: 'single',
    dimension,
    stem: String(stem).trim(),
    options: rotated,
    correctIndex,
    explanation: `正确答案：${correctText}。${hint}`,
    difficulty: Math.max(1, Math.min(3, Math.trunc(Number(difficulty)) || 1))
  }
}

// 把一组数据按固定步长切成若干变体，生成器用它控制题量与难度梯度。
export function range(start, count, step = 1) {
  return Array.from({ length: count }, (_, index) => start + index * step)
}

// 归一化题干用于去重：去掉空白和标点差异，避免同一道题重复入库。
export function stemKey(stem) {
  return String(stem || '').replace(/[\s，。；：、（）()]/g, '').trim()
}

// 按「题型族」批量装配单选题：每个族给出 [题干, 正确答案, 干扰项, 可选解析]，
// 解析默认取族级 hint（可写函数），seed 控制选项轮转，答案与解析始终一致。
export function buildChapter(families) {
  const items = []
  families.forEach((family, familyIndex) => {
    family.rows.forEach((row, index) => {
      const [stem, correct, wrongs, rowHint] = row
      const hint = rowHint || (typeof family.hint === 'function' ? family.hint(correct, stem) : family.hint)
      items.push(makeQuestion({
        stem,
        correct,
        wrongs,
        hint: hint || `根据知识点，正确答案是 ${correct}。`,
        difficulty: family.difficulty || 1,
        dimension: family.dimension || 'concept',
        seed: familyIndex * 10 + index
      }))
    })
  })
  return items
}
