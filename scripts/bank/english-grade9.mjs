// 初三英语题库生成器：从句、被动语态、情态动词与时态、完形策略、阅读推断、中考写作结构。
// 题目来自固定语法规则和固定语篇，答案与解析一一对应。
import { buildChapter } from './english-common.mjs'

// 宾语从句与定语从句
function clauses() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'concept',
      hint: (correct, stem) => `宾语从句用陈述语序，不能用疑问句语序；本题应为 ${correct}。`,
      rows: [
        ['Can you tell me ______?', 'where the museum is', ['where is the museum', 'where the museum was', 'where does the museum']],
        ['I wonder ______.', 'why he was absent', ['why was he absent', 'why he did absent', 'why he absent']],
        ['Please tell me ______.', 'how I can get to the station', ['how can I get to the station', 'how I can got to the station', 'how do I can get to the station']],
        ['She asked me ______.', 'what I wanted to eat', ['what did I want to eat', 'what I wanted eat', 'what do I want to eat']],
        ['Do you know ______?', 'when he will come back', ['when will he come back', 'when he will comes back', 'when does he come back']],
        ["I don't know ______.", 'whether he has finished the work', ['whether has he finished the work', 'whether he has finish the work', 'if has he finished the work']],
        ['He asked ______.', 'where I lived', ['where did I live', 'where I was live', 'where I living']],
        ['Could you tell me ______?', 'what time the train arrives', ['what time does the train arrive', 'what time the train arrive', 'what time is the train arrive']],
        ['I want to know ______.', 'how long it takes to get there', ['how long does it take to get there', 'how long it take to get there', 'how long is it take to get there']],
        ['Nobody knows ______.', 'who broke the window', ['who did broke the window', 'whom broke the window', 'who the window broke']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `先行词是人用 who/whom，是物用 which，表示所属关系用 whose；本题应为 ${correct}。`,
      rows: [
        ['The man ______ is talking to Mr. Li is my father.', 'who', ['which', 'whose', 'whom']],
        ['The book ______ I bought yesterday is very interesting.', 'which', ['who', 'whose', 'whom']],
        ['The girl ______ hair is long is my sister.', 'whose', ['who', 'which', 'whom']],
        ['This is the house ______ we lived in last year.', 'which', ['who', 'whose', 'whom']],
        ["The boy ______ we met at the gate is Tom's brother.", 'whom', ['which', 'whose', 'what']],
        ['I like the film ______ we saw last night.', 'that', ['who', 'whose', 'whom']],
        ['The doctor ______ helped me is very kind.', 'who', ['which', 'whose', 'whom']],
        ['The tree ______ leaves are green is an old one.', 'whose', ['who', 'which', 'whom']],
        ['The pen ______ he is using is mine.', 'which', ['who', 'whose', 'whom']],
        ['The students ______ are playing football are from Class Two.', 'who', ['which', 'whose', 'whom']]
      ]
    },
    {
      difficulty: 3,
      dimension: 'transfer',
      hint: (correct, stem) => `先行词是地点用 where、时间用 when、原因用 why；先行词被最高级、序数词或 the very 修饰时多用 that；本题应为 ${correct}。`,
      rows: [
        ['This is the place ______ we stayed last year.', 'where', ['which', 'that', 'who']],
        ['I still remember the day ______ we first met.', 'when', ['which', 'who', 'whose']],
        ['This is the reason ______ he was late.', 'why', ['which', 'who', 'whose']],
        ['The house ______ we live is very old.', 'where', ['which', 'that', 'who']],
        ['I like the way ______ he speaks.', 'that', ['which', 'who', 'what']],
        ['This is the best film ______ I have ever seen.', 'that', ['which', 'who', 'whose']],
        ['The first thing ______ we should do is to call him.', 'that', ['which', 'who', 'whose']],
        ['This is the very book ______ I want.', 'that', ['which', 'who', 'whose']],
        ['All ______ we need is a good plan.', 'that', ['which', 'who', 'whose']],
        ['There is nothing ______ can stop him.', 'that', ['which', 'who', 'whose']]
      ]
    }
  ])
}

// 被动语态综合
function passiveVoice() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `一般过去时被动语态结构为 was/were + 过去分词；本题应为 ${correct}。`,
      rows: [
        ['The bridge ______ (build) in 1990.', 'was built', ['built', 'was building', 'is built']],
        ['The homework ______ (finish) by Tom last night.', 'was finished', ['finished', 'was finishing', 'is finished']],
        ['These photos ______ (take) in Beijing last year.', 'were taken', ['took', 'were taking', 'are taken']],
        ['The window ______ (break) by the boy yesterday.', 'was broken', ['broke', 'was breaking', 'is broken']],
        ['The trees ______ (plant) by the students last spring.', 'were planted', ['planted', 'were planting', 'are planted']],
        ['The song ______ (sing) by a famous singer last night.', 'was sung', ['sang', 'was singing', 'is sung']],
        ['The meeting ______ (hold) last Friday.', 'was held', ['held', 'was holding', 'is held']],
        ['The eggs ______ (eat) by the children this morning.', 'were eaten', ['ate', 'were eating', 'are eaten']],
        ['The letter ______ (write) by my grandfather in 1980.', 'was written', ['wrote', 'was writing', 'is written']],
        ['The cars ______ (make) in China last year.', 'were made', ['made', 'were making', 'are made']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `一般将来时被动语态结构为 will be + 过去分词；本题应为 ${correct}。`,
      rows: [
        ['The meeting ______ (hold) tomorrow.', 'will be held', ['will hold', 'will be hold', 'is held']],
        ['The new library ______ (build) next year.', 'will be built', ['will build', 'will be build', 'is built']],
        ['The results ______ (announce) tomorrow morning.', 'will be announced', ['will announce', 'will be announce', 'are announced']],
        ['More trees ______ (plant) next spring.', 'will be planted', ['will plant', 'will be plant', 'are planted']],
        ['The sports meeting ______ (hold) next week.', 'will be held', ['will hold', 'will be hold', 'is held']],
        ['The work ______ (finish) in two days.', 'will be finished', ['will finish', 'will be finish', 'is finished']],
        ['The new hospital ______ (open) next month.', 'will be opened', ['will open', 'will be open', 'is opened']],
        ['The problem ______ (solve) at the meeting.', 'will be solved', ['will solve', 'will be solve', 'is solved']],
        ['The tickets ______ (sell) online next week.', 'will be sold', ['will sell', 'will be sell', 'are sold']],
        ['A new road ______ (build) here next year.', 'will be built', ['will build', 'will be build', 'is built']]
      ]
    },
    {
      difficulty: 3,
      dimension: 'transfer',
      hint: (correct, stem) => `现在完成时被动语态结构为 has/have been + 过去分词；本题应为 ${correct}。`,
      rows: [
        ['The work ______ (finish) already.', 'has been finished', ['has finished', 'is finished', 'was finished']],
        ['The room ______ (clean) already.', 'has been cleaned', ['has cleaned', 'is cleaned', 'was cleaned']],
        ['The homework ______ (check) by the teacher.', 'has been checked', ['has checked', 'is checked', 'was checked']],
        ['Many trees ______ (plant) since 2010.', 'have been planted', ['have planted', 'are planted', 'were planted']],
        ['The book ______ (translate) into many languages.', 'has been translated', ['has translated', 'is translated', 'was translated']],
        ['The bridge ______ (repair) already.', 'has been repaired', ['has repaired', 'is repaired', 'was repaired']],
        ['The tickets ______ (sell) out.', 'have been sold', ['have sold', 'are sold', 'were sold']],
        ['The letter ______ (send) to him.', 'has been sent', ['has sent', 'is sent', 'was sent']],
        ['The new rules ______ (make) by the school.', 'have been made', ['have made', 'are made', 'were made']],
        ['The car ______ (wash) three times this week.', 'has been washed', ['has washed', 'is washed', 'was washed']]
      ]
    }
  ])
}

// 情态动词与时态复习
function modalsAndTenses() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'concept',
      hint: (correct, stem) => `must 表示肯定推测，can't 表示否定推测，might 表示可能性较小的推测；本题应为 ${correct}。`,
      rows: [
        ['The light is on in his room. He ______ be at home.', 'must', ["can't", "needn't", "shouldn't"]],
        ["The book ______ be Tom's. His name is on it.", 'must', ["can't", "needn't", "shouldn't"]],
        ['She ______ be at school now. I saw her at the cinema just now.', "can't", ['must', "needn't", "shouldn't"]],
        ["The bag ______ be Lily's. It has her name on it.", 'must', ["can't", "needn't", "shouldn't"]],
        ["He ______ come tomorrow, but I'm not sure.", 'might', ['must', "can't", "shouldn't"]],
        ['The answer ______ be right. There is a mistake in it.', "can't", ['must', "needn't", "shouldn't"]],
        ['The boy ______ be hungry. He has just eaten two bowls of noodles.', "can't", ['must', "needn't", "shouldn't"]],
        ['The story ______ be true. Everyone says it happened.', 'must', ["can't", "needn't", "shouldn't"]],
        ['The dictionary ______ be mine. My name is on the cover.', 'must', ["can't", "needn't", "shouldn't"]],
        ['It ______ rain this afternoon, so take an umbrella.', 'might', ['must', "can't", "shouldn't"]]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `先看时间状语（now / yesterday / since / tomorrow / at this time yesterday）判断时态；本题应为 ${correct}。`,
      rows: [
        ['Look! The children ______ (play) football.', 'are playing', ['play', 'played', 'will play']],
        ['I ______ (visit) my uncle yesterday.', 'visited', ['visit', 'have visited', 'will visit']],
        ['She ______ (live) here since 2018.', 'has lived', ['lived', 'lives', 'was living']],
        ['We ______ (have) a picnic tomorrow.', 'will have', ['had', 'have had', 'has']],
        ['He ______ (read) a book at this time yesterday.', 'was reading', ['read', 'is reading', 'has read']],
        ['My father ______ (work) in this factory for ten years.', 'has worked', ['worked', 'works', 'was working']],
        ['They ______ (go) to the zoo last Sunday.', 'went', ['go', 'have gone', 'will go']],
        ['Listen! Someone ______ (sing) in the next room.', 'is singing', ['sings', 'sang', 'will sing']],
        ['I ______ (know) him since we were children.', 'have known', ['knew', 'know', 'was knowing']],
        ['She ______ (finish) her homework already.', 'has finished', ['finished', 'finishes', 'was finishing']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `按情态动词的含义（可能性、必要性、禁止、建议）和简答规则判断；本题应为 ${correct}。`,
      rows: [
        ['Which modal verb means "it is possible but not certain"? 哪个词表示「可能但不一定」？（ ）', 'might', ['must', 'can', 'need']],
        ['Which modal verb means "it is not necessary"? 哪个词表示「不必要」？（ ）', "needn't", ["mustn't", "can't", "shouldn't"]],
        ['Which modal verb means "it is not allowed"? 哪个词表示「不允许」？（ ）', "mustn't", ["needn't", "shouldn't", "wouldn't"]],
        ['Which modal verb is used to give advice? 哪个词常用来提建议？（ ）', 'should', ['can', 'may', 'will']],
        ['— Must I finish the work now?\n— No, you ______.', "needn't", ["mustn't", "can't", "won't"]],
        ['— Can I use your dictionary?\n— Yes, ______.', 'you can', ['you must', "you needn't", "you can't"]],
        ["You ______ smoke here. It's a hospital.", "mustn't", ["needn't", 'may', 'could']],
        ["You ______ take an umbrella. It's going to rain.", 'should', ["needn't", "mustn't", "can't"]],
        ['We ______ hurry. There is plenty of time.', "needn't", ["mustn't", "can't", "won't"]],
        ['— Could you help me?\n— ______', 'Sure.', ["You're welcome.", "That's right.", 'Never mind.']]
      ]
    }
  ])
}

// 完形填空策略
function clozeStrategies() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'concept',
      hint: (correct, stem) => `按固定搭配判断，本题应填 ${correct}。`,
      rows: [
        ['Finally, he ______ a decision to study harder.', 'made', ['did', 'took', 'got']],
        ['Many students ______ part in the sports meeting.', 'took', ['joined', 'attended', 'made']],
        ['We should ______ attention to our spelling.', 'pay', ['take', 'make', 'give']],
        ['She is good ______ playing the piano.', 'at', ['in', 'on', 'for']],
        ["I'm looking forward to ______ from you.", 'hearing', ['hear', 'heard', 'hears']],
        ['He is interested ______ science.', 'in', ['at', 'on', 'for']],
        ['She spends two hours ______ her homework every day.', 'on', ['in', 'at', 'for']],
        ['Can you help me ______ my English?', 'with', ['in', 'on', 'at']],
        ['We are proud ______ our country.', 'of', ['in', 'at', 'on']],
        ['Tom gets on well ______ his classmates.', 'with', ['to', 'for', 'at']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `根据上下文语境选词，只有 ${correct} 符合句意。`,
      rows: [
        ['It was raining hard. The students ______ at the bus stop, waiting for the bus.', 'stood', ['sang', 'cooked', 'slept']],
        ['The little girl was lost. She looked around and began to ______.', 'cry', ['laugh', 'smile', 'sing']],
        ['The soup is too ______. Let it cool down first.', 'hot', ['cold', 'sweet', 'sour']],
        ["He didn't study hard, so he ______ the exam.", 'failed', ['passed', 'took', 'liked']],
        ['The old man lives ______, but he never feels lonely.', 'alone', ['together', 'loudly', 'angrily']],
        ["My alarm clock didn't ring, so I was ______ for school.", 'late', ['early', 'ready', 'sorry']],
        ['Please ______ the door when you leave.', 'close', ['open', 'break', 'paint']],
        ['The baby is sleeping. Please speak ______.', 'quietly', ['loudly', 'quickly', 'angrily']],
        ["It's very ______ today. Put on your coat.", 'cold', ['hot', 'sunny', 'warm']],
        ["He ______ his keys, so he couldn't open the door.", 'lost', ['found', 'bought', 'washed']]
      ]
    },
    {
      difficulty: 3,
      dimension: 'method',
      hint: (correct, stem) => `分析前后句逻辑关系，本题应填 ${correct}。`,
      rows: [
        ['He was ill. ______, he still went to school.', 'However', ['Therefore', 'Because', 'So']],
        ['It was very late, ______ we decided to go home.', 'so', ['but', 'although', 'because']],
        ['______ it was raining, they went out.', 'Although', ['Because', 'So', 'Therefore']],
        ["She walked quickly ______ she wouldn't be late.", 'so that', ['although', 'because', 'however']],
        ['I like both music ______ sports.', 'and', ['but', 'or', 'so']],
        ['He is old, ______ he is still strong.', 'but', ['and', 'so', 'because']],
        ['______ you work hard, you will succeed.', 'If', ['Although', 'Because', 'But']],
        ['You can come ______ you like.', 'whenever', ['because', 'although', 'so']],
        ['It was raining, ______ we stayed at home.', 'so', ['but', 'although', 'or']],
        ['______ he was tired, he kept working.', 'Though', ['Because', 'So', 'If']]
      ]
    }
  ])
}

// 阅读理解与推断
function readingAndInference() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'concept',
      hint: (correct, stem) => `根据文中细节推断言外之意，本题可以推断「${correct}」。`,
      rows: [
        ['When the teacher announced the result, Lisa jumped up and hugged her friend. 由此可以推断（ ）', 'Lisa did well in the test.', ['Lisa failed the test.', 'Lisa was ill.', 'Lisa was late.']],
        ['The street was full of water, and cars moved very slowly. 由此可以推断（ ）', 'It had rained heavily.', ['It was snowing.', 'It was sunny.', 'It was windy.']],
        ['Jack kept looking at his phone and smiling. 由此可以推断（ ）', 'Jack received good news.', ['Jack lost his phone.', 'Jack was angry.', 'Jack was sleepy.']],
        ['The lights in the office were still on at midnight. 由此可以推断（ ）', 'Someone was still working.', ['The office was empty.', 'The office was closed.', 'The office was new.']],
        ['Amy put on her coat, took her umbrella and went out. 由此可以推断（ ）', 'The weather was bad.', ['It was hot outside.', 'Amy was going to bed.', 'Amy was at home.']],
        ['The little boy covered his ears when the train passed by. 由此可以推断（ ）', 'The train was very noisy.', ['The train was empty.', 'The train was late.', 'The train was slow.']],
        ['The students all stood up and clapped when the old scientist walked in. 由此可以推断（ ）', 'They respected the scientist.', ['They knew nothing about him.', 'They wanted to leave.', 'They were afraid of him.']],
        ['Peter ran all the way home and shouted that he got the first prize. 由此可以推断（ ）', 'Peter was excited.', ['Peter was sad.', 'Peter was tired.', 'Peter was angry.']],
        ['The shop assistant checked the price tag twice and said that the item was not for sale. 由此可以推断（ ）', 'The item cannot be bought now.', ['The item is free.', 'The item is new.', 'The item is cheap.']],
        ['Lucy looked at the menu for a long time and ordered only a cup of tea. 由此可以推断（ ）', 'Lucy did not want to spend much.', ['Lucy was very hungry.', 'Lucy liked the restaurant.', 'Lucy was a waitress.']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `作者态度通过评价性词语判断，本题体现「${correct}」。`,
      rows: [
        ['It is important for us to protect wild animals. We should stop buying things made from them. 作者的态度是（ ）', '支持保护动物', ['反对保护动物', '担心动物太少', '觉得与自己无关']],
        ['Some students spend too much time on their phones. This is bad for their eyes and study. 作者的态度是（ ）', '担忧', ['赞赏', '支持', '无所谓']],
        ['What a wonderful performance! The dancers did a great job. 作者的态度是（ ）', '赞赏', ['失望', '反对', '担心']],
        ["I don't think it is a good idea to eat too much junk food. 作者的态度是（ ）", '不赞同', ['支持', '感激', '好奇']],
        ['Reading in bed for a long time may hurt your eyes. 作者的态度是（ ）', '提醒', ['祝贺', '反对阅读', '开玩笑']],
        ['Our team lost the game, but we will try harder next time. 作者的态度是（ ）', '积极乐观', ['消极失望', '生气抱怨', '无所谓']],
        ['The new rule is unfair to small shops. 作者的态度是（ ）', '反对', ['支持', '感激', '害怕']],
        ['Thank you for your help. You are so kind. 作者的态度是（ ）', '感激', ['抱怨', '怀疑', '骄傲']],
        ['The traffic problem is getting worse. We must do something about it. 作者的态度是（ ）', '担忧', ['满意', '兴奋', '骄傲']],
        ['It is fun to learn English through songs. 作者的态度是（ ）', '赞同', ['反对', '担忧', '失望']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `看文本的场合和目的，本题的写作目的是「${correct}」。`,
      rows: [
        ['Come and join our English Club! We meet every Friday afternoon. 这段话的写作目的是（ ）', '招募成员', ['发布通知', '表示感谢', '介绍学校']],
        ['Please remember: no food or drink in the computer room. 这段话的写作目的是（ ）', '提醒规则', ['招募成员', '促销商品', '表示感谢']],
        ['Buy one get one free this weekend! 这段话的写作目的是（ ）', '促销', ['提醒规则', '寻物', '通知停课']],
        ['Lost: a black wallet. Please call 12345678. 这段话的写作目的是（ ）', '寻物', ['招领', '促销', '招聘']],
        ['The school library will be closed on Monday. 这段话的写作目的是（ ）', '通知', ['感谢', '建议', '道歉']],
        ['Dear Tom, thank you for inviting me to your birthday party. 这段话的写作目的是（ ）', '感谢', ['邀请', '投诉', '通知']],
        ['How to stay healthy: eat well, exercise often and sleep enough. 这段话的写作目的是（ ）', '建议', ['感谢', '促销', '寻物']],
        ['Our city has changed a lot in the past ten years. 这段话的写作目的是（ ）', '介绍变化', ['招募成员', '提醒规则', '表示感谢']],
        ['Do you want to be a volunteer? Call us at 87654321. 这段话的写作目的是（ ）', '招募志愿者', ['寻物', '促销', '通知停课']],
        ['Please take your umbrella. It will rain this afternoon. 这段话的写作目的是（ ）', '提醒', ['邀请', '感谢', '促销']]
      ]
    }
  ])
}

// 中考写作结构
function examWritingStructure() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'concept',
      hint: (correct, stem) => `主题句概括段落中心，支持句提供细节，结尾句收束全段；本题属于「${correct}」。`,
      rows: [
        ['Every student should have a healthy lifestyle. 这句话在段落中的作用是（ ）', '主题句', ['支持句', '结尾句', '过渡句']],
        ['For example, we can run for half an hour every day. 这句话在段落中的作用是（ ）', '支持句', ['主题句', '结尾句', '标题']],
        ['In a word, a healthy lifestyle makes us happier. 这句话在段落中的作用是（ ）', '结尾句', ['主题句', '支持句', '过渡句']],
        ['Reading is important for middle school students. 这句话在段落中的作用是（ ）', '主题句', ['支持句', '结尾句', '标题']],
        ['First, we should save water in our daily life. 这句话在段落中的作用是（ ）', '支持句', ['主题句', '结尾句', '标题']],
        ['In conclusion, we should protect the environment together. 这句话在段落中的作用是（ ）', '结尾句', ['主题句', '支持句', '过渡句']],
        ['Different people have different ways to relax. 这句话在段落中的作用是（ ）', '主题句', ['支持句', '结尾句', '标题']],
        ['For instance, some students listen to music after class. 这句话在段落中的作用是（ ）', '支持句', ['主题句', '结尾句', '标题']],
        ['All in all, it was an unforgettable trip. 这句话在段落中的作用是（ ）', '结尾句', ['主题句', '支持句', '过渡句']],
        ['Volunteering helps us learn more about the world. 这句话在段落中的作用是（ ）', '主题句', ['支持句', '结尾句', '过渡句']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `按连接词表达的逻辑关系判断，本题应为 ${correct}。`,
      rows: [
        ['First, ... Second, ... ______, ...', 'Finally', ['However', 'Because', 'Although']],
        ['______, we can see that protecting the environment is important.（总结）', 'In a word', ['First', 'For example', 'Besides']],
        ['表示递进关系的连接词是（ ）', 'besides', ['however', 'therefore', 'otherwise']],
        ['表示转折关系的连接词是（ ）', 'however', ['besides', 'therefore', 'so that']],
        ['表示因果关系的连接词是（ ）', 'therefore', ['although', 'besides', 'for example']],
        ['表示举例关系的连接词是（ ）', 'for example', ['however', 'therefore', 'otherwise']],
        ['表示总结关系的连接词是（ ）', 'in a word', ['first', 'besides', 'however']],
        ['表示目的关系的连接词是（ ）', 'so that', ['although', 'however', 'besides']],
        ['表示并列关系的连接词是（ ）', 'and', ['but', 'because', 'if']],
        ['表示选择关系的连接词是（ ）', 'or', ['and', 'but', 'so']]
      ]
    },
    {
      difficulty: 1,
      dimension: 'basic-application',
      hint: (correct, stem) => `按中考英语书面表达规范判断，本题应为「${correct}」。`,
      rows: [
        ['中考英语作文一般建议分为（ ）', '3 段左右', ['1 段', '6 段以上', '越多越好']],
        ['每段第一句通常写（ ）', '主题句', ['细节', '例子', '结尾']],
        ['作文中的例子应该（ ）', '支持观点', ['与主题无关', '越长越好', '重复主题句']],
        ['作文字数不足时，最有效的做法是（ ）', '补充具体细节和例子', ['重复同一句话', '写无关内容', '加大字号']],
        ['作文写完后应该（ ）', '检查时态、拼写和标点', ['直接交卷', '重新抄一遍', '删除所有连接词']],
        ['英文书信中，称呼后面通常用（ ）', '逗号', ['句号', '问号', '感叹号']],
        ['英文作文标题通常（ ）', '实词首字母大写', ['全部小写', '全部大写', '用中文写']],
        ['记叙文通常使用的主要时态是（ ）', '一般过去时', ['一般现在时', '一般将来时', '现在完成时']],
        ['说明文和议论文通常使用的主要时态是（ ）', '一般现在时', ['一般过去时', '过去进行时', '过去完成时']],
        ['写自己的经历时，通常使用（ ）', '第一人称', ['第二人称', '第三人称', '不用人称']]
      ]
    }
  ])
}

export const bankGroup = {
  grade: '初三',
  subject: '英语',
  edition: '人教版',
  generators: {
    '宾语从句与定语从句': clauses,
    '被动语态综合': passiveVoice,
    '情态动词与时态复习': modalsAndTenses,
    '完形填空策略': clozeStrategies,
    '阅读理解与推断': readingAndInference,
    '中考写作结构': examWritingStructure
  }
}
