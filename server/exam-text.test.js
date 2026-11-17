import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExamQuestions, reflowText } from './exam-text.js'

test('试卷流水文本按题切开，选项和答案解析各归各位', () => {
  const text = [
    '4. 小明发现衣柜里的樟脑丸越来越小，这是（',
    '）',
    'A. 熔化',
    'B. 升华',
    'C. 汽化',
    'D. 凝固',
    '【答案】B',
    '【解析】',
    '【详解】樟脑丸由固态直接变成气态，属于升华。'
  ].join('\n')
  const { questions } = parseExamQuestions(text)
  assert.equal(questions.length, 1)
  assert.match(questions[0].stem, /樟脑丸越来越小/)
  // 括号组被合成不换行空格，不能出现「（」单独占一行
  assert.match(questions[0].stem, /（\u00a0\u00a0）/)
  assert.deepEqual(questions[0].options.map(item => item.key), ['A', 'B', 'C', 'D'])
  assert.equal(questions[0].answer, 'B')
  // 【解析】是空标题，真正内容在【详解】，合并后只保留一段
  assert.equal(questions[0].analysis, '樟脑丸由固态直接变成气态，属于升华。')
})

test('解析与详解都有内容时合并成一段', () => {
  const text = [
    '1. 下列说法正确的是（ ）',
    'A. 甲',
    'B. 乙',
    '【答案】A',
    '【解析】先看概念。',
    '【详解】再逐项排除。'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  // 两段内容合并成一段，中间不留换行
  assert.equal(question.analysis, '先看概念。再逐项排除。')
})

test('选项全空的选择题整题丢弃，避免只剩 A. B. C. D.', () => {
  const text = ['6. 如图，选出正确的一项（ ）', 'A.', 'B.', 'C.', 'D.', '【答案】C'].join('\n')
  // 答案是 C 却没有任何选项，说明选项在 PDF 里是图片，题目残缺，不展示
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('题号之前的残句作为 lead，题数按 limit 截断', () => {
  const text = [
    '2022 年广东省初中学业水平考试',
    '1. 第一题（ ）',
    'A. 甲',
    'B. 乙',
    '【答案】A',
    '2. 第二题（ ）',
    'A. 丙',
    'B. 丁',
    '【答案】B',
    '3. 第三题（ ）',
    'A. 戊',
    'B. 己',
    '【答案】A'
  ].join('\n')
  const result = parseExamQuestions(text, { limit: 2 })
  assert.match(result.lead, /学业水平考试/)
  assert.equal(result.questions.length, 2)
  assert.equal(result.questions[1].number, '2')
})

test('片段截断留下的半题被丢弃', () => {
  const text = [
    '1. 完整题（ ）',
    'A. 甲',
    'B. 乙',
    '【答案】A',
    '2. 被截断的题，选项还没写完',
    'A. 丙',
    'B. 丁'
  ].join('\n')
  const { questions } = parseExamQuestions(text)
  assert.equal(questions.length, 1)
  assert.equal(questions[0].number, '1')
})

test('PDF 碎片行重排成段，图片占位符被剔除', () => {
  const text = [
    '22.5',
    'COF',
    '□ □',
    '【小问2 详解】',
    '过点A作AP',
    'x',
    '轴，如图所示:',
    '∵',
    '(4,3)',
    'A,',
    '∴'
  ].join('\n')
  const output = reflowText(text)
  // 图占位符不应出现在页面文本里
  assert.doesNotMatch(output, /[□▯]/)
  // 纯数值/英文碎片之间补空格，不能粘成一个词
  assert.match(output, /22\.5 COF/)
  // 小问标记单独成段，后面的解答另起
  const paragraphs = output.split('\n\n')
  assert.equal(paragraphs[0], '22.5 COF')
  assert.equal(paragraphs[1], '【小问2 详解】')
  assert.match(paragraphs[2], /^过点A作AP/)
  // 中文碎片直接衔接，x轴 不能断成两行
  assert.match(paragraphs[2], /AP x轴，如图所示:/)
  // 推到末尾的推导符号保留，不丢内容
  assert.match(output, /∵ \(4,3\) A,/)
})

test('段落标记另起一段，超长片段按 maxParagraphs 截断', () => {
  // 「故选」「答：」这类标记另起一段，普通句子仍接在上一段后面。
  const text = ['第一段内容。', '故选 A。', '第二段内容。', '答：成立。'].join('\n')
  assert.equal(reflowText(text), '第一段内容。\n\n故选 A。第二段内容。\n\n答：成立。')
  assert.equal(reflowText(text, { maxParagraphs: 2 }), '第一段内容。\n\n故选 A。第二段内容。')
})

test('无答案解析的片段兜底时选项各占一行', () => {
  const text = ['9. 下列说法正确的是（', '）', 'A. 甲', 'B.', 'C. 丙', 'D. 丁'].join('\n')
  const output = reflowText(text)
  assert.match(output, /说法正确的是（\u00a0\u00a0）\n\nA\. 甲\n\nC\. 丙\n\nD\. 丁/)
  // 只剩选项字母的空行没有信息量，不能单独占一行
  assert.doesNotMatch(output, /^B\.$/m)
})

test('表格类题干保持逐行，不被粘成一段', () => {
  const text = [
    '11. 下表为翻译书目。这些活动（',
    '）',
    '书名',
    '原著者',
    '《格致小引》',
    '（英）赫施赉',
    'A. 甲',
    'B. 乙',
    'C. 丙',
    'D. 丁',
    '【答案】A'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  assert.match(question.stem, /书名\n原著者\n《格致小引》/)
  assert.doesNotMatch(question.stem, /书名原著者/)
})

test('题干里被 PDF 折行的句子重新接成一段', () => {
  const text = [
    '24. 若返回舱质量为',
    '3 10 kg',
    '，在着陆过程中，从距地面1m 高处竖直向下落地，用时0.4s。',
    '【答案】3×103kg'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  assert.doesNotMatch(question.stem, /\n/)
  assert.match(question.stem, /质量为 3 10 kg，在着陆过程中/)
})

test('PDF 私用区符号映射成真实运算符，不显示成方块', () => {
  const text = '14. 若 x\uF03D是方程 x\uF02D2x\uF02Ba\uF03D0 的根，则 \uE123 a ______.\n【答案】\uF070'
  const [question] = parseExamQuestions(text).questions
  assert.doesNotMatch(question.stem, /[\uE000-\uF8FF\uFFFD]/)
  assert.match(question.stem, /x−2x\+a=0/)
  assert.equal(question.answer, 'π')
})

test('公式被拆散的题整题不展示', () => {
  const text = [
    '16. （1）计算：2023 3 8 | 5 | ( 1)+−+−；',
    '（2）已知一次函数y',
    'kx',
    'b',
    '=',
    '+',
    '的图象经过点(0,1)与点(2,5)，求该一次函数的表达式．',
    '【答案】（1）6；（2）y x=+'
  ].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('选项缺项的题不展示', () => {
  const text = ['2. 计算2 的结果是（ ）', 'A. 1', 'C. 2', 'D. 4', '【答案】D'].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('解析里公式乱码时只隐藏解析，保留题目', () => {
  const text = [
    '3. 下列图形是轴对称图形的是（ ）',
    'A. 甲',
    'B. 乙',
    'C. 丙',
    'D. 丁',
    '【答案】B',
    '【详解】解：y kx b =+，故选B．'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  assert.equal(question.answer, 'B')
  assert.equal(question.analysis, '')
})

test('截断在只有小问编号的答案处时丢弃该题', () => {
  const text = ['1. 求：', '（1）第一问；', '【答案】（1）'].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('编号答案按题号归位，不会显示成下一题的答案', () => {
  const text = [
    '6. 加蓬位于（ ）',
    'A. 印度洋东岸', 'B. 大西洋西岸', 'C. 低纬度地区', 'D. 中纬度地区',
    '7. 加蓬的气候类型主要是（ ）',
    'A. 热带沙漠气候', 'B. 热带草原气候', 'C. 地中海气候', 'D. 热带雨林气候',
    '【答案】6. C'
  ].join('\n')
  const { questions } = parseExamQuestions(text)
  // 第 7 题没有答案、没有解析，按半题丢弃；第 6 题拿回自己的 C
  assert.equal(questions.length, 1)
  assert.equal(questions[0].number, '6')
  assert.equal(questions[0].answer, 'C')
})

test('上一题答案被误当成新题时直接剔除', () => {
  const text = [
    '5. B',
    '【解析】',
    '【5 题详解】第四题解析。',
    '6. 加蓬位于（ ）',
    'A. 印度洋东岸', 'B. 大西洋西岸', 'C. 低纬度地区', 'D. 中纬度地区',
    '【答案】C'
  ].join('\n')
  const { questions } = parseExamQuestions(text)
  assert.equal(questions.length, 1)
  assert.equal(questions[0].number, '6')
})

test('编号解析挂回对应题目，不属于本片段的解析被丢弃', () => {
  const text = [
    '9. 第九题（ ）',
    'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁',
    '10. 第十题（ ）',
    'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁',
    '【答案】9. A',
    '10. B',
    '【解析】',
    '【9 题详解】第九题解析。',
    '【10 题详解】第十题解析。'
  ].join('\n')
  const { questions } = parseExamQuestions(text)
  assert.equal(questions.length, 2)
  assert.equal(questions[0].answer, 'A')
  assert.equal(questions[0].analysis, '第九题解析。')
  assert.equal(questions[1].answer, 'B')
  assert.equal(questions[1].analysis, '第十题解析。')
})

test('等号中间夹孤立操作数判为公式错位', () => {
  const text = [
    '3. 下列图形是轴对称图形的是（ ）',
    'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁',
    '【答案】B',
    '【详解】解：2 2 = x =，故选B．'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  assert.equal(question.answer, 'B')
  assert.equal(question.analysis, '')
})

test('片段从解析中间开始时，导语不展示答案解析', () => {
  const text = [
    '3．绿色植物还通过光合作用维持碳氧平衡。',
    '【详解】A．蒸腾作用正确。',
    '故选D。'
  ].join('\n')
  const result = parseExamQuestions(text)
  assert.equal(result.lead, '')
  assert.equal(result.questions.length, 0)
})

test('只剩 it 这类残词的英语题干被丢弃', () => {
  const text = ['4. it', 'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁', '【答案】A'].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('着重号变成的连续句点被清掉', () => {
  const text = [
    '3. 下列说法错误．．的是（ ）',
    'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁',
    '【答案】B'
  ].join('\n')
  const [question] = parseExamQuestions(text).questions
  assert.equal(question.stem, '下列说法错误的是（\u00a0\u00a0）')
})

test('选项只剩字母本身的选择题整题丢弃', () => {
  const text = [
    '19. 下列名著中，人物关系不正确的一项是（ ）选项作品名称人物 A《骆驼祥子》父女',
    'A. A', 'B. B', 'C. C', 'D. D',
    '【答案】A'
  ].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('英语题干只剩一个单词时丢弃', () => {
  const text = ['50. habit', 'A. 甲', 'B. 乙', 'C. 丙', 'D. 丁', '【答案】A'].join('\n')
  assert.equal(parseExamQuestions(text).questions.length, 0)
})

test('全角点句号改成中文句号，因为所以符号后留空格', () => {
  const output = reflowText([
    '众数．',
    '解：∵5 是这组数据中出现次数最多的数，∴这组数据的众数为5．',
    '3．5 与 2．5 的平均数是 3．',
    '故选A．',
    'A．'
  ].join('\n'))
  assert.match(output, /众数。/)
  assert.match(output, /∵ 5 是这组数据/)
  assert.match(output, /∴ 这组数据的众数为5。/)
  // 小数点不能被当成句号
  assert.match(output, /3．5 与 2．5 的平均数是 3。/)
  // 句末跟在选项字母后的全角点同样算句号：「故选A．」→「故选A。」
  assert.match(output, /故选A。/)
  // 只剩选项字母的空行（A．→A。）仍按噪声剔除，不占一段
  assert.doesNotMatch(output, /^A。$/m)
  assert.doesNotMatch(output, /^A．$/m)
})
