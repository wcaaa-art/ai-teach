// RAG 检索评测集：每条用例的期望关键词都取自索引里的真实真题原文，可客观判定。
// 用例集与评测脚本分离，方便单独维护、单独展示，也方便以后随语料更新同步。
// 断言规则：Top-K 结果里至少有一条 subject 命中期望学科，且正文包含期望关键词。

export const RAG_EVAL_CASES = [
  // ===== 数学 =====
  { id: 'math-triangle-stable', subject: '数学', grade: '初三', query: '哪种图形具有稳定性', expectKeywords: ['稳定性'] },
  { id: 'math-point-translate', subject: '数学', grade: '初三', query: '点在平面直角坐标系中平移后坐标怎么变', expectKeywords: ['平移'] },
  { id: 'math-function', subject: '数学', grade: '初三', query: '一次函数的图像和性质', expectKeywords: ['函数'] },
  { id: 'math-quadratic', subject: '数学', grade: '初三', query: '二次函数顶点式求最值', expectKeywords: ['二次函数'] },

  // ===== 物理 =====
  { id: 'physics-sublimation', subject: '物理', grade: '初三', query: '樟脑丸放在衣柜里慢慢变小是什么物态变化', expectKeywords: ['升华'] },
  { id: 'physics-energy', subject: '物理', grade: '初三', query: '一次能源和二次能源有什么区别', expectKeywords: ['能源'] },
  { id: 'physics-ohm', subject: '物理', grade: '初三', query: '欧姆定律电流与电压的关系', expectKeywords: ['欧姆定律'] },

  // ===== 化学 =====
  { id: 'chem-material', subject: '化学', grade: '初三', query: '聚乙烯纤维属于什么材料', expectKeywords: ['合成材料'] },
  { id: 'chem-elements', subject: '化学', grade: '初三', query: '屠呦呦研究青蒿素获诺贝尔奖', expectKeywords: ['屠呦呦'] },
  { id: 'chem-equation', subject: '化学', grade: '初三', query: '化学方程式配平怎么算', expectKeywords: ['化学方程式'] },

  // ===== 语文 =====
  { id: 'chinese-recite', subject: '语文', grade: '初三', query: '默写古诗文名句', expectKeywords: ['默写'] },
  { id: 'chinese-pinyin', subject: '语文', grade: '初三', query: '根据拼音写出相应的词语', expectKeywords: ['拼音'] },
  { id: 'chinese-classic', subject: '语文', grade: '初三', query: '文言文虚词「之」的用法', expectKeywords: ['文言'] },

  // ===== 英语 =====
  { id: 'english-job', subject: '英语', grade: '初三', query: 'What is the man job 职业听力', expectKeywords: ['job'] },
  { id: 'english-time', subject: '英语', grade: '初三', query: 'What time does it start 时间表达', expectKeywords: ['time'] },

  // ===== 历史 =====
  { id: 'history-piluo', subject: '历史', grade: '初三', query: '皮洛遗址出土的手斧属于什么时期', expectKeywords: ['皮洛'] },
  { id: 'history-qin-county', subject: '历史', grade: '初三', query: '秦朝郡县制和分封制', expectKeywords: ['郡县'] },
  { id: 'history-fujian', subject: '历史', grade: '初三', query: '苻坚重用汉族儒生尊孔', expectKeywords: ['苻坚'] },

  // ===== 地理 =====
  { id: 'geo-contour', subject: '地理', grade: '初三', query: '等高线地形图判断山峰海拔', expectKeywords: ['等高线'] },
  { id: 'geo-revolution', subject: '地理', grade: '初三', query: '地球公转春秋分夏至太阳直射点', expectKeywords: ['公转'] },

  // ===== 生物 =====
  { id: 'bio-cell-nucleus', subject: '生物', grade: '初三', query: '细胞生命活动的控制中心是什么', expectKeywords: ['细胞核'] },
  { id: 'bio-meristem', subject: '生物', grade: '初三', query: '植物分生组织能分裂产生新叶', expectKeywords: ['分生组织'] },

  // ===== 道德与法治 =====
  { id: 'morality-emotion', subject: '道德与法治', grade: '初三', query: '美好的情感能够传递正能量', expectKeywords: ['情感'] }
]

// 期望检索不到任何片段的负例：过短或与语料无关的问题不能硬凑结果。
export const RAG_NEGATIVE_CASES = [
  { id: 'negative-too-short', query: '哈' },
  { id: 'negative-unrelated', query: 'zzzzzzzzxxxx' }
]

export const RAG_EVAL_TOP_K = 4
