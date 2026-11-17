// 知识点讲解本地包：按「学科 + 章节名」索引，随章节资料一次返回，全程不调用模型。
// 教材版本不同会多出目录外的单元，这时退回本地基础讲解，保证页面点开就有内容。
import { MATH_LESSONS } from './math.js'
import { PHYSICS_LESSONS } from './physics.js'
import { CHEMISTRY_LESSONS } from './chemistry.js'
import { ENGLISH_LESSONS } from './english.js'
import { CHINESE_LESSONS } from './chinese.js'
import { HISTORY_LESSONS } from './history.js'
import { GEOGRAPHY_LESSONS } from './geography.js'
import { BIOLOGY_LESSONS } from './biology.js'
import { POLITICS_LESSONS } from './politics.js'

const PACKS = {
  '数学': MATH_LESSONS,
  '物理': PHYSICS_LESSONS,
  '化学': CHEMISTRY_LESSONS,
  '英语': ENGLISH_LESSONS,
  '语文': CHINESE_LESSONS,
  '历史': HISTORY_LESSONS,
  '地理': GEOGRAPHY_LESSONS,
  '生物': BIOLOGY_LESSONS,
  '道德与法治': POLITICS_LESSONS
}

const SUBJECT_STEPS = {
  '数学': ['先弄清这一节引入的新符号和新定义，再记公式适用的条件。', '公式不要只背结论，自己代一组数验证一遍。', '例题先遮住答案做，卡住的地方就是需要回看的地方。'],
  '物理': ['先判断这一节描述的是哪种现象，再找对应的物理量和单位。', '公式里的每个字母代表什么、单位是什么，要能逐个说出来。', '实验题先看变量怎么控制，再看结论从哪组数据得出。'],
  '化学': ['先分清这一节讲的是物质、性质还是反应。', '化学用语（符号、方程式、条件）要按规范书写，不能只记结果。', '实验现象和结论分开记，避免把现象当结论。'],
  '英语': ['先看这一节练的是哪个句型或时态，再记结构。', '把结构和例句一起记，单记规则容易忘。', '读题时先圈时间状语，它通常决定时态。'],
  '语文': ['先看这一节练的是阅读方法还是表达方法。', '把术语换成自己的话解释一遍，说不清就是没懂。', '答题时先定位原文，再组织语言，避免凭印象写。'],
  '历史': ['先按时间线把这一节的事件排好顺序。', '每个事件记清「时间、原因、经过、影响」四件事。', '材料题先看材料出处和设问，再回材料里找依据。'],
  '地理': ['先看这一节讲的是自然要素还是人文要素。', '地图和图表先读图名、图例和单位，再读数据。', '原因类题目按「位置 → 气候 → 地形 → 人类活动」的顺序推。'],
  '生物': ['先弄清这一节的结构名称和功能对应关系。', '过程类知识按顺序画一遍流程图，比背文字有效。', '实验题先找对照组和变量。'],
  '道德与法治': ['先看这一节对应的生活情境和核心观点。', '观点要能配一个具体例子，不能只背关键词。', '材料题先提炼材料中的关键词，再对应教材观点。']
}

function fallbackLesson({ grade = '', subject = '', chapterName = '', unitLabel = '' }) {
  const steps = SUBJECT_STEPS[subject] || [
    '先用自己的话复述这一节要解决的问题。',
    '把新出现的概念、公式和单位整理成一页笔记。',
    '做两道基础题检验，再回头看卡住的地方。'
  ]
  return {
    intro: `「${chapterName}」是${grade}${subject}${unitLabel ? `（${unitLabel}）` : ''}的核心内容。先弄清它在解释什么、用哪些公式或方法描述，再去看下面的例题，效率会比直接刷题高。`,
    points: steps,
    formulas: [],
    source: 'local'
  }
}

/**
 * 取章节讲解：命中静态包返回 pack，目录外章节返回 local 基础讲解。
 * 两种都只读本地数据，不会发起网络请求。
 */
export function getLocalLesson({ grade = '', subject = '', chapterName = '', unitLabel = '' } = {}) {
  const packed = PACKS[subject]?.[chapterName]
  if (packed) return { ...packed, source: 'pack' }
  return fallbackLesson({ grade, subject, chapterName, unitLabel })
}
