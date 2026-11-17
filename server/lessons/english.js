// 初中英语知识点讲解（静态包）：卡片放句型模板，expr 是可直接照抄的例句。
export const ENGLISH_LESSONS = {
  '日常交际与自我介绍': {
    intro: '第一次见到外国朋友，怎么打招呼、怎么介绍自己、怎么礼貌地结束对话？这一节把最常用的交际句型一次备齐。',
    points: [
      '打招呼用 Hello / Hi，正式场合用 Good morning / afternoon / evening',
      '自我介绍先说名字：I\'m … / My name is …，再说来自哪里和爱好',
      '询问对方信息用 What\'s your name? / Where are you from?',
      '道别用 Goodbye / See you / Have a nice day',
      '回答 How are you? 用 I\'m fine, thank you，不要重复问题'
    ],
    formulas: [
      { name: '自我介绍', expr: 'I\'m Li Hua. I\'m from China.', note: '名字 + 来处' },
      { name: '问候', expr: 'How are you? — I\'m fine, thank you.', note: '询问状态' },
      { name: '道别', expr: 'See you tomorrow. / Have a good day.', note: '礼貌结束对话' }
    ]
  },
  '一般现在时': {
    intro: '每天起床、每周上课、太阳从东边升起——习惯和事实都用一般现在时。它是英语里出场率最高的时态。',
    points: [
      '主语是第三人称单数时，动词要加 s 或 es',
      '否定句用 don\'t / doesn\'t + 动词原形',
      '一般疑问句用 Do / Does 开头，回答用 do / does',
      '频度副词 always、usually、often、sometimes、never 常和它连用',
      '客观事实和自然规律永远用一般现在时'
    ],
    formulas: [
      { name: '肯定句', expr: 'He plays basketball every day.', note: '三单动词加 s' },
      { name: '否定句', expr: 'She doesn\'t like coffee.', note: 'doesn\'t 后动词用原形' },
      { name: '疑问句', expr: 'Do you speak English? — Yes, I do.', note: 'Do/Does 提到句首' }
    ]
  },
  '名词与代词': {
    intro: '一只猫是 a cat，两只猫是 two cats；我的书是 my book，不是 I book。名词单复数和代词，是造句最先要过的关。',
    points: [
      '可数名词复数一般加 s，以 s、x、ch、sh 结尾加 es',
      '不规则复数：man→men，child→children，foot→feet',
      '不可数名词没有复数，用 much、a little 修饰',
      '主格作主语，宾格作宾语，形容词性物主代词后面必须接名词',
      '名词所有格表示「谁的」，单数加 \'s，以 s 结尾的复数只加 \''
    ],
    formulas: [
      { name: '复数规则', expr: 'cat→cats；box→boxes；city→cities', note: '辅音字母+y 变 y 为 i 加 es' },
      { name: '物主代词', expr: 'my book / mine', note: '形容词性后接名词，名词性单独用' },
      { name: '所有格', expr: 'Tom\'s bag；the students\' books', note: '以 s 结尾只加 \'' }
    ]
  },
  'There be 句型': {
    intro: '桌子上有一本书、书包里有两支笔——中文说「有」，英语里表示某处存在某物要用 There be，而不是 have。',
    points: [
      'There be 表示「某地存在某物」，have 表示「某人拥有某物」',
      'be 动词单复数看紧挨着的第一个名词，遵循就近原则',
      '否定句在 be 后加 not，疑问句把 be 提前',
      'some 用于肯定句，any 用于否定句和疑问句',
      'There is a book and two pens on the desk 谓语仍用 is'
    ],
    formulas: [
      { name: '单数', expr: 'There is a book on the desk.', note: '就近名词是单数' },
      { name: '复数', expr: 'There are two pens in the bag.', note: '就近名词是复数' },
      { name: '疑问', expr: 'Is there a park near here? — Yes, there is.', note: 'be 动词提前' }
    ]
  },
  '一般过去时入门': {
    intro: '昨天做了什么、上周去了哪里——讲已经发生并且结束的事，就要用一般过去时。中文靠「了」表示过去，英语靠动词变形，这一点先记住。',
    points: [
      '规则动词过去式加 ed，以 e 结尾加 d，辅音字母+y 变 y 为 i 加 ed',
      '不规则动词要单独记：go→went，see→saw，have→had',
      '否定句用 didn\'t + 动词原形，didn\'t 后面不能再用过去式',
      '一般疑问句用 Did 开头，回答用 did / didn\'t',
      'yesterday、last week、two days ago 提示用过去时'
    ],
    formulas: [
      { name: '肯定句', expr: 'I visited my grandma yesterday.', note: '动词用过去式' },
      { name: '否定句', expr: 'He didn\'t go to school.', note: 'didn\'t 后动词用原形' },
      { name: '疑问句', expr: 'Did you see the film? — Yes, I did.', note: 'Did 提到句首' }
    ]
  },
  '阅读策略与语篇理解': {
    intro: '考试阅读时间紧，逐词翻译根本做不完。这一节讲怎么先看题、再定位、最后比对，把时间花在有分的地方。',
    points: [
      '先读题干圈关键词，再回原文定位，不要从头逐字翻译',
      '主旨题看首段、末段和每段首句',
      '细节题按关键词定位到句，再比对选项',
      '猜词题看上下文，尤其看前后句的解释和转折',
      '选项里堆满原文原词的，往往不是正确答案'
    ],
    formulas: [
      { name: '主旨题', expr: 'What is the passage mainly about?', note: '看首尾段和段首句' },
      { name: '细节题', expr: '关键词定位 → 同义替换比对', note: '答案不一定用原词' },
      { name: '猜词题', expr: '看前后句的解释、举例、转折', note: '不认识的词也能推' }
    ]
  },
  '一般过去时与过去进行时': {
    intro: '「昨天我写了一封信」和「昨天八点我正在写信」——都发生在过去，但一个说完成，一个说当时正在进行。',
    points: [
      '一般过去时强调动作发生并结束，过去进行时强调某一时刻正在进行',
      '过去进行时结构是 was/were + doing',
      'when 常接短暂动作（一般过去时），while 常接持续动作（过去进行时）',
      '两个动作同时进行时都用过去进行时，常用 while 连接',
      'at eight last night 这类时间点提示用过去进行时'
    ],
    formulas: [
      { name: '过去进行时', expr: 'I was reading at 8 last night.', note: 'was/were + doing' },
      { name: 'when 从句', expr: 'I was walking when it rained.', note: '短动作常用一般过去时' },
      { name: 'while 从句', expr: 'While I was cooking, he was watching TV.', note: '两个持续动作' }
    ]
  },
  '现在完成时入门': {
    intro: '「我已经做完作业了」——动作发生在过去，但结果现在还影响着。这就是现在完成时和一般过去时最大的区别。',
    points: [
      '结构是 have/has + 过去分词',
      '强调过去动作对现在的影响，不强调动作发生的时间',
      'already 用于肯定句，yet 用于否定句和疑问句',
      'for + 一段时间，since + 时间点',
      '不能和 yesterday、last week 这类明确过去时间连用'
    ],
    formulas: [
      { name: '现在完成时', expr: 'I have finished my homework.', note: 'have/has + 过去分词' },
      { name: 'for / since', expr: 'for three years；since 2020', note: 'for 接时间段，since 接时间点' },
      { name: '与过去时区别', expr: 'I have lost my key.（现在还没找到）', note: '强调对现在的影响' }
    ]
  },
  '情态动词与被动语态': {
    intro: '「你必须戴头盔」「这本书是被他写的」——情态动词表达态度，被动语态强调动作承受者，两者都是中考高频点。',
    points: [
      '情态动词后面接动词原形，没有人称和数的变化',
      'must 表示必须，mustn\'t 表示禁止，don\'t have to 表示不必',
      'can 表示能力或许可，may 表示可以或可能',
      '被动语态结构是 be + 过去分词，be 随时态和主语变化',
      '只有及物动词才有被动语态'
    ],
    formulas: [
      { name: '情态动词', expr: 'You must wear a helmet.', note: '后接动词原形' },
      { name: '现在时被动', expr: 'English is spoken in many countries.', note: 'am/is/are + 过去分词' },
      { name: '过去时被动', expr: 'The bridge was built in 2008.', note: 'was/were + 过去分词' }
    ]
  },
  '宾语从句入门': {
    intro: '「我知道他在哪里」「你能告诉我怎么走吗」——把一个句子当作宾语，就是宾语从句。它最容易错在语序和时态。',
    points: [
      '宾语从句一律用陈述句语序，不能用疑问句语序',
      '主句是现在时，从句时态按实际需要选择',
      '主句是过去时，从句一般要用相应的过去时态',
      '客观真理永远用一般现在时',
      'if / whether 表示「是否」，特殊疑问词引导时保留疑问词'
    ],
    formulas: [
      { name: '陈述语序', expr: 'Do you know where he lives?', note: '不是 where does he live' },
      { name: '时态呼应', expr: 'He said he was busy.', note: '主句过去，从句也用过去' },
      { name: '客观真理', expr: 'The teacher said the earth goes around the sun.', note: '从句仍用现在时' }
    ]
  },
  '阅读理解策略': {
    intro: '阅读题不是翻译比赛。会定位、会排除、会看结构，往往比认识每一个单词更有用。这一节把考场上最省时间的读法拆开讲。',
    points: [
      '先看题目类型：主旨、细节、推断、词义，不同类型找的位置不同',
      '细节题用关键词回原文定位，注意同义替换',
      '推断题不能选原文直接写出的句子，要选能推出的结论',
      '排除绝对化选项，all、never、must 这类词要警惕',
      '长篇阅读先看每段首句，快速建立结构'
    ],
    formulas: [
      { name: '定位法', expr: '题干关键词 → 原文同义句', note: '不靠通读全文' },
      { name: '排除法', expr: '绝对化、无中生有、偷换概念', note: '三错一对' },
      { name: '结构法', expr: '首段主旨 + 段首句', note: '快速抓框架' }
    ]
  },
  '书面表达组织': {
    intro: '写英语作文最怕没话说、写成中文式英语。其实评分看的是要点齐全、结构清楚、句型有点变化。',
    points: [
      '先列要点提纲，确保题目要求的信息一个不漏',
      '分三段：开头点题、中间展开、结尾总结',
      '用 first、besides、however、finally 这类连接词让逻辑清楚',
      '句型要有变化：简单句、并列句、复合句搭配使用',
      '写完后检查时态、主谓一致、名词单复数和拼写'
    ],
    formulas: [
      { name: '三段式', expr: '开头点题 → 主体展开 → 结尾总结', note: '结构分最容易拿' },
      { name: '连接词', expr: 'first / besides / however / finally', note: '让文章有逻辑' },
      { name: '检查清单', expr: '时态、三单、单复数、拼写', note: '留两分钟通读' }
    ]
  },
  '宾语从句与定语从句': {
    intro: '「他说的那本书，就是我昨天提到的」——一句话里套两个从句，中文都绕，英语更要有章法。这一节把两大从句的引导词和语序理清。',
    points: [
      '宾语从句用陈述语序，主句是过去时的时候时态要呼应',
      '定语从句修饰名词，紧跟在先行词后面',
      '先行词是人用 who/that，是物用 which/that',
      '关系代词作宾语时可以省略，作主语时不能省',
      '只能用 that 的情况：先行词被最高级、序数词或 all、only 修饰'
    ],
    formulas: [
      { name: '宾语从句', expr: 'I think (that) he is right.', note: 'that 可省略，语序是陈述句' },
      { name: '定语从句（人）', expr: 'The boy who won the prize is my friend.', note: 'who 作主语不能省' },
      { name: '定语从句（物）', expr: 'The book which I bought is useful.', note: 'which/that 作宾语可省' }
    ]
  },
  '被动语态综合': {
    intro: '中文说「桥被建好了」，英语用被动语态。科技说明、新闻报道里被动特别多，中考也常考。',
    points: [
      '被动语态结构是 be + 过去分词，be 随时态变化',
      '一般将来时被动：will be + 过去分词',
      '现在完成时被动：have/has been + 过去分词',
      '含情态动词的被动：情态动词 + be + 过去分词',
      '主动变被动：宾语提前作主语，动词变 be + 过去分词，原主语放 by 后'
    ],
    formulas: [
      { name: '一般现在时被动', expr: 'The classroom is cleaned every day.', note: 'am/is/are + done' },
      { name: '一般将来时被动', expr: 'The work will be finished tomorrow.', note: 'will be + done' },
      { name: '情态动词被动', expr: 'The rule must be followed.', note: '情态动词 + be + done' }
    ]
  },
  '情态动词与时态复习': {
    intro: 'must、can、may、could、should 每个都认识，一放到题里就混。这一节用「语气强弱 + 场景」把它们串起来。',
    points: [
      'must 语气最强表示必须，should 表示应该，can 表示能够',
      'must 开头的疑问句，否定回答用 needn\'t 或 don\'t have to',
      'can\'t 表示否定推测「不可能」，must 表示肯定推测「一定」',
      '时间状语是判断时态的第一线索',
      '现在完成时和一般过去时的区别在于是否强调对现在的影响'
    ],
    formulas: [
      { name: '推测语气', expr: 'must 一定 > may 可能 > can\'t 不可能', note: '按可能性从高到低' },
      { name: 'must 问句答语', expr: 'Must I go now? — No, you needn\'t.', note: '不用 mustn\'t 回答' },
      { name: '时态线索', expr: 'already / yet / for / since → 现在完成时', note: '先找时间词' }
    ]
  },
  '完形填空策略': {
    intro: '完形填空考的不是单词量，而是上下文逻辑。每个空都能在前后文找到线索，关键是先通读、再填空、最后回读检查。',
    points: [
      '先通读全文抓大意，不要看一个空填一个空',
      '第二遍再逐空选择，先易后难',
      '注意上下文复现：同义词、反义词、同类词往往在前面出现过',
      '关注转折词 but、however、although，它们决定语义方向',
      '填完把答案代回全文通读，检查逻辑和语法'
    ],
    formulas: [
      { name: '三步法', expr: '通读 → 逐空 → 回读', note: '不要边看边填' },
      { name: '逻辑词', expr: 'but / however / because / so', note: '决定前后语义' },
      { name: '复现法', expr: '前后文同义、反义、同类词', note: '答案常藏在上下文' }
    ]
  },
  '阅读理解与推断': {
    intro: '推断题最坑：选项里有一句和原文一模一样，但往往不是答案。推断要往前一步，又不能凭空想。',
    points: [
      '推断题答案必须能从原文推出，不能是原文没提的内容',
      '照抄原文句子的选项通常是干扰项',
      '作者态度看形容词和评价性词汇',
      '指代题往前找最近的名词，注意单复数一致',
      '标题题要覆盖全文，不能只概括某一段'
    ],
    formulas: [
      { name: '推断', expr: '原文依据 + 合理一步', note: '不能凭空想象' },
      { name: '态度', expr: '关注形容词、副词、评价词', note: 'positive / negative / neutral' },
      { name: '标题', expr: '覆盖全文，短而具体', note: '只概括一段的排除' }
    ]
  },
  '中考写作结构': {
    intro: '中考作文分值不低，结构清楚比堆高级词更划算。阅卷老师看的是：要点全不全、分段清不清楚、有没有明显语法错误。',
    points: [
      '审题先圈要点，列提纲，确保内容分不丢',
      '分三段写，每段一个中心，段落之间用连接词',
      '开头直接点题，不要绕圈子',
      '适当用复合句和固定搭配，但别为了炫技写错',
      '留两分钟检查时态、三单、单复数、拼写和字数'
    ],
    formulas: [
      { name: '三段式', expr: '点题 → 展开（2-3 个要点）→ 总结', note: '结构清晰' },
      { name: '万能连接', expr: 'What\'s more / However / As a result', note: '让逻辑显性化' },
      { name: '检查清单', expr: '时态一致、主谓一致、拼写、字数', note: '每项都要过一遍' }
    ]
  }
}
