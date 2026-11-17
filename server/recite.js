// 背诵内容生成：语文/文科按句切分，英语按词表切分。
// 模型只负责「把内容排版成可逐条比对的结构」，不负责虚构原文——
// 所以提示词强制要求原文照录，并在前端留一次人工确认，防住幻觉。
import { safeFilter } from './agent.js'

export const RECITE_CONTENT_PROMPT = `你是“知行 AI 学伴”的背诵内容整理 Agent，服务初中学生。用户会给出学科、计划名称、年级和知识点标签（JSON），你要产出可以直接用于逐句/逐词背诵的结构化内容。

硬性要求：
1. 只输出计划名称所指的那一篇/那一组内容，不要扩展成课外延伸。名称里出现篇名（如《诫子书》）时必须给出该篇原文，不得改写、缩写或自创。
2. 不确定原文时，宁可少写也不要编造；宁可只给开头几句确定的部分。
3. 全部使用简体中文（英语词条除外）。不要出现 markdown 代码围栏，只返回合法 JSON。

输出格式二选一：
- 中文记忆类（古诗文、课文、知识点条目）：{"kind":"text","title":"内容标题","lines":[{"text":"一句原文，不带序号","hint":"这句话的意思或记忆抓手，20 字内"}]}
- 英语单词类：{"kind":"words","title":"词表标题","words":[{"word":"单词","phonetic":"/音标/","meaning":"词性 + 中文释义","example":"一个简短英文例句"}]}

数量要求：中文 6-20 句，按句号、问号、叹号或分号断句，一句一行，不要把整段塞进一行；英语 10-20 个词，优先选计划名称和标签涉及的词。
hint 要具体（点出易错字、句式或画面），不要写“理解句意”这类空话。
特别约束——如果内容是化学方程式（出现 → 或 = 的反应式），hint 只能写实验现象（火焰颜色、沉淀、气体、气味、发光放热等），绝不能写配平系数、化学式下标、物质名称对照、催化剂书写位置这类「书写细节」。这类方程式的 hint 留空也可以。`

// 本地兜底语料：模型不可用时也要能背。只收录初中阶段常见篇目，
// 且都是通行版本，避免因为版本差异把原文写错。
const LOCAL_TEXTS = [
  {
    match: /诫子书/,
    title: '《诫子书》· 诸葛亮',
    lines: [
      ['夫君子之行，静以修身，俭以养德。', '开篇点出君子的两条修养路径'],
      ['非淡泊无以明志，非宁静无以致远。', '「淡泊」「宁静」是条件，不是境界'],
      ['夫学须静也，才须学也，非学无以广才，非志无以成学。', '静—学—才—志四者环环相扣'],
      ['淫慢则不能励精，险躁则不能治性。', '「淫慢」「险躁」是两种反面'],
      ['年与时驰，意与日去，遂成枯落，多不接世。', '注意「驰」「枯落」的写法'],
      ['悲守穷庐，将复何及！', '收尾是感叹，不是疑问']
    ]
  },
  {
    match: /陋室铭/,
    title: '《陋室铭》· 刘禹锡',
    lines: [
      ['山不在高，有仙则名。', '起兴，用山引出「名」'],
      ['水不在深，有龙则灵。', '与上一句对仗，注意「灵」不是「名」'],
      ['斯是陋室，惟吾德馨。', '全篇主旨句，「馨」字易写错'],
      ['苔痕上阶绿，草色入帘青。', '「上」「入」两个动词把静景写活'],
      ['谈笑有鸿儒，往来无白丁。', '「鸿儒」对「白丁」'],
      ['可以调素琴，阅金经。', '「素琴」指不加装饰的琴'],
      ['无丝竹之乱耳，无案牍之劳形。', '两句都用「无」字起'],
      ['南阳诸葛庐，西蜀子云亭。', '用两个古人居所自比'],
      ['孔子云：何陋之有？', '以反问收束，呼应开头']
    ]
  },
  {
    match: /爱莲说/,
    title: '《爱莲说》· 周敦颐',
    lines: [
      ['水陆草木之花，可爱者甚蕃。', '「蕃」读 fán，意为多'],
      ['晋陶渊明独爱菊。', '菊是隐逸者的象征'],
      ['自李唐来，世人甚爱牡丹。', '牡丹代表富贵'],
      ['予独爱莲之出淤泥而不染，濯清涟而不妖。', '「濯」「妖」是易错点'],
      ['中通外直，不蔓不枝。', '写莲的形态，也写人格'],
      ['香远益清，亭亭净植。', '「益」是更加的意思'],
      ['可远观而不可亵玩焉。', '「亵」字易写错']
    ]
  },
  {
    match: /论语/,
    title: '《论语》十二章 · 选段',
    lines: [
      ['学而时习之，不亦说乎？', '「说」通「悦」'],
      ['有朋自远方来，不亦乐乎？', '「乐」与上句的「说」层次不同'],
      ['人不知而不愠，不亦君子乎？', '「愠」读 yùn，意为恼怒'],
      ['温故而知新，可以为师矣。', '「故」指旧知识'],
      ['学而不思则罔，思而不学则殆。', '「罔」与「殆」是一对'],
      ['知之者不如好之者，好之者不如乐之者。', '三层递进，别写漏一层']
    ]
  },
  {
    match: /春望/,
    title: '《春望》· 杜甫',
    lines: [
      ['国破山河在，城春草木深。', '以乐景写哀，反差在「深」字'],
      ['感时花溅泪，恨别鸟惊心。', '移情于物'],
      ['烽火连三月，家书抵万金。', '「抵万金」是夸张'],
      ['白头搔更短，浑欲不胜簪。', '「簪」字易写错']
    ]
  },
  {
    match: /次北固山下/,
    title: '《次北固山下》· 王湾',
    lines: [
      ['客路青山外，行舟绿水前。', '开篇点明羁旅身份'],
      ['潮平两岸阔，风正一帆悬。', '「阔」与「悬」一横一纵'],
      ['海日生残夜，江春入旧年。', '「生」「入」把时序写活'],
      ['乡书何处达？归雁洛阳边。', '以问句收，落到思乡']
    ]
  },
  {
    match: /木兰诗/,
    title: '《木兰诗》· 开头部分',
    lines: [
      ['唧唧复唧唧，木兰当户织。', '「唧唧」是织布声，也是叹息声'],
      ['不闻机杼声，惟闻女叹息。', '「杼」读 zhù'],
      ['问女何所思，问女何所忆。', '两句一问，注意「忆」不是「意」'],
      ['女亦无所思，女亦无所忆。', '重复句式，是民歌的特点']
    ]
  }
]

// 通用兜底：篇目没收录时，用计划名拆成几条待补内容，让用户自己粘贴原文。
// 比编造一段假古文安全得多。
function manualFallback(name, subject) {
  return {
    kind: 'text',
    title: name,
    needsManual: true,
    lines: [],
    notice: `本地没有收录「${name}」的原文。点右侧「手动录入」粘贴课本上的文字，确认后会保存在本机，下次直接背。`
  }
}

// 英语兜底词表：初中高频词，模型不可用时先能跑通流程。
const LOCAL_WORDS = [
  ['achieve', '/əˈtʃiːv/', 'v. 实现；达到', 'She worked hard to achieve her goal.'],
  ['ancient', '/ˈeɪnʃənt/', 'adj. 古代的；古老的', 'We visited an ancient city.'],
  ['attention', '/əˈtenʃn/', 'n. 注意；关注', 'Please pay attention to the teacher.'],
  ['balance', '/ˈbæləns/', 'n./v. 平衡', 'It is hard to balance study and rest.'],
  ['compare', '/kəmˈpeə(r)/', 'v. 比较；对比', 'Compare your answer with mine.'],
  ['confident', '/ˈkɒnfɪdənt/', 'adj. 自信的', 'She feels confident before the exam.'],
  ['develop', '/dɪˈveləp/', 'v. 发展；培养', 'Reading helps develop your mind.'],
  ['difficult', '/ˈdɪfɪkəlt/', 'adj. 困难的', 'This question is quite difficult.'],
  ['encourage', '/ɪnˈkʌrɪdʒ/', 'v. 鼓励', 'My teacher encouraged me to try again.'],
  ['environment', '/ɪnˈvaɪrənmənt/', 'n. 环境', 'We should protect the environment.'],
  ['experience', '/ɪkˈspɪəriəns/', 'n. 经验；经历', 'It was a wonderful experience.'],
  ['famous', '/ˈfeɪməs/', 'adj. 著名的', 'He is famous for his poems.'],
  ['imagine', '/ɪˈmædʒɪn/', 'v. 想象', 'Imagine you are in a forest.'],
  ['improve', '/ɪmˈpruːv/', 'v. 改进；提高', 'I want to improve my English.'],
  ['knowledge', '/ˈnɒlɪdʒ/', 'n. 知识', 'Knowledge comes from practice.'],
  ['memory', '/ˈmeməri/', 'n. 记忆；记忆力', 'Good sleep helps your memory.'],
  ['necessary', '/ˈnesəsəri/', 'adj. 必要的', 'It is necessary to take notes.'],
  ['opinion', '/əˈpɪnjən/', 'n. 意见；看法', 'In my opinion, he is right.'],
  ['patient', '/ˈpeɪʃnt/', 'adj. 有耐心的', 'Be patient with your classmates.'],
  ['practice', '/ˈpræktɪs/', 'n./v. 练习', 'Practice makes perfect.'],
  ['progress', '/ˈprəʊgres/', 'n. 进步', 'You have made great progress.'],
  ['pronounce', '/prəˈnaʊns/', 'v. 发音', 'How do you pronounce this word?'],
  ['recognize', '/ˈrekəɡnaɪz/', 'v. 认出；识别', 'I recognized her at once.'],
  ['sentence', '/ˈsentəns/', 'n. 句子', 'Write a sentence with this word.'],
  ['similar', '/ˈsɪmələ(r)/', 'adj. 相似的', 'These two words look similar.'],
  ['suggest', '/səˈdʒest/', 'v. 建议', 'I suggest taking a short break.'],
  ['support', '/səˈpɔːt/', 'v./n. 支持', 'My parents support my study.'],
  ['tradition', '/trəˈdɪʃn/', 'n. 传统', 'It is a Chinese tradition.'],
  ['understand', '/ˌʌndəˈstænd/', 'v. 理解', 'I understand what you mean now.'],
  ['valuable', '/ˈvæljuəbl/', 'adj. 宝贵的', 'Time is valuable for students.']
]

function localWords(name) {
  return {
    kind: 'words',
    title: name || '高频词表',
    words: LOCAL_WORDS.map(([word, phonetic, meaning, example]) => ({ word, phonetic, meaning, example })),
    notice: '这是本地内置的初中高频词表。想要与本条计划对应的词表，可以点「重新生成」或手动替换。'
  }
}

/**
 * 模型不可用或结果不合法时的本地兜底。
 * @param {{ subject?: string, name?: string, kind?: string }} input
 */
export function fallbackReciteContent(input = {}) {
  const name = safeFilter(String(input.name || '').trim()).slice(0, 40)
  const subject = String(input.subject || '')
  if (input.kind === 'words' || subject === '英语') return localWords(name)
  const hit = LOCAL_TEXTS.find(item => item.match.test(name))
  if (!hit) return manualFallback(name || '背诵内容', subject)
  return {
    kind: 'text',
    title: hit.title,
    needsManual: false,
    lines: hit.lines.map(([text, hint]) => ({ text, hint })),
    notice: '内容来自本机内置课标篇目，可点「手动录入」按课本版本校正。'
  }
}

// 校验并收敛模型输出：句数、词数、长度都设上限，防止一次返回整本书。
export function normalizeReciteContent(raw, input = {}) {
  const kind = raw?.kind === 'words' || input.kind === 'words' ? 'words' : 'text'
  const title = safeFilter(String(raw?.title || input.name || '背诵内容')).slice(0, 40)
  if (kind === 'words') {
    const words = (Array.isArray(raw?.words) ? raw.words : [])
      .map(item => ({
        word: safeFilter(String(item?.word || '')).trim().slice(0, 40),
        phonetic: String(item?.phonetic || '').trim().slice(0, 40),
        meaning: safeFilter(String(item?.meaning || '')).trim().slice(0, 60),
        example: String(item?.example || '').trim().slice(0, 120)
      }))
      .filter(item => item.word && item.meaning)
      .slice(0, 40)
    if (!words.length) throw new Error('empty words')
    return { kind, title, words, notice: '' }
  }
  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .map(item => ({
      text: safeFilter(String(item?.text || '')).trim().slice(0, 200),
      hint: safeFilter(String(item?.hint || '')).trim().slice(0, 60)
    }))
    .filter(item => item.text.length >= 2)
    .slice(0, 40)
  if (!lines.length) throw new Error('empty lines')
  return { kind, title, lines, notice: '' }
}
