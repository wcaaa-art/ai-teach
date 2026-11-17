// 查询侧术语扩展：学生不会用课标原词提问。
// 说"抛物线顶点"的人，卷子上印的是"二次函数"；说"三角形稳不稳"的人，考的是"稳定性"。
// BM25 只看字面，这类改写会直接召回空结果，所以这里维护一份人工核对过的别名表，
// 命中即把同组词追加进查询（不动原文，只在检索侧扩展）。

// 只收「同一个意思的两种说法」，不收上下位关系（那是知识图谱的活，容易把结果带偏）。
const ALIAS_GROUPS = [
  ['二次函数', '抛物线', '顶点式', '顶点坐标'],
  ['一次函数', '直线方程', '图像与性质'],
  ['稳定性', '稳定', '不易变形'],
  ['平移', '左右平移', '上下平移'],
  ['欧姆定律', '电流与电压', '电阻关系'],
  ['升华', '直接变成气体', '樟脑丸变小'],
  ['化学方程式', '配平', '反应式'],
  ['合成材料', '聚乙烯', '塑料纤维'],
  ['辛亥革命', '武昌起义', '推翻帝制'],
  ['虎门销烟', '林则徐', '禁烟'],
  ['光合作用', '光反应', '暗反应'],
  ['议论文', '论证方法', '论点论据'],
  ['文言实词', '古今异义', '通假字'],
  ['现在完成时', 'have done', '完成时态'],
  ['阅读理解', '主旨大意', '细节理解']
]

/**
 * 展开查询：原文 + 命中的别名组里的其它说法。
 * @param {string} query
 * @returns {{ expanded: string, added: string[] }}
 */
export function expandQuery(query = '') {
  const text = String(query || '')
  const added = []
  for (const group of ALIAS_GROUPS) {
    const hit = group.some(word => text.includes(word))
    if (!hit) continue
    for (const word of group) {
      if (!text.includes(word)) added.push(word)
    }
  }
  // 扩展词最多 8 个：太多会把 BM25 的查询向量稀释掉，反而降低精度。
  const limited = [...new Set(added)].slice(0, 8)
  return { expanded: limited.length ? `${text} ${limited.join(' ')}` : text, added: limited }
}

export function aliasGroups() { return ALIAS_GROUPS.length }
