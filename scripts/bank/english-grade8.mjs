// 初二英语题库生成器：过去时对比、现在完成时、情态动词与被动语态、宾语从句、阅读策略、书面表达。
// 所有答案由固定语法规则和固定短文推出，不使用模型生成。
import { buildChapter } from './english-common.mjs'

// 一般过去时与过去进行时
function pastAndPastContinuous() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `过去进行时表示过去某一时刻正在进行的动作，结构为 was/were + 动词-ing；本题应为 ${correct}。`,
      rows: [
        ["At eight o'clock last night, I ______ my homework.", 'was doing', ['did', 'do', 'am doing']],
        ['At this time yesterday, they ______ basketball.', 'were playing', ['played', 'play', 'are playing']],
        ['When I got home, my mother ______ dinner.', 'was cooking', ['cooked', 'cooks', 'is cooking']],
        ['At nine yesterday morning, she ______ an English class.', 'was having', ['had', 'has', 'is having']],
        ['The students ______ when the teacher came in.', 'were talking', ['talked', 'talk', 'are talking']],
        ['At ten last night, he ______ TV.', 'was watching', ['watched', 'watches', 'is watching']],
        ['While we ______, it began to rain.', 'were walking', ['walked', 'walk', 'are walking']],
        ['At 7:00 yesterday evening, my parents ______ the dishes.', 'were washing', ['washed', 'wash', 'are washing']],
        ['She ______ a book at that time.', 'was reading', ['read', 'reads', 'is reading']],
        ['The children ______ football when it started to rain.', 'were playing', ['played', 'play', 'are playing']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `when 后常接短暂性动作，while 后常接持续性动作；本题应填 ${correct}。`,
      rows: [
        ['She was cooking ______ the phone rang.', 'when', ['while', 'before', 'after']],
        ['______ I was walking on the street, I met an old friend.', 'While', ['Before', 'After', 'If']],
        ['I was doing my homework ______ my mother came back.', 'when', ['while', 'before', 'after']],
        ['______ the bell rang, the students were singing.', 'When', ['While', 'Before', 'After']],
        ['He was sleeping ______ the phone rang.', 'when', ['while', 'before', 'after']],
        ['______ she was cleaning the room, her brother was watching TV.', 'While', ['Before', 'After', 'Until']],
        ['They were playing outside ______ it began to rain.', 'when', ['while', 'before', 'after']],
        ['______ we were having dinner, the lights went out.', 'While', ['Before', 'After', 'Until']],
        ['She was washing her face ______ someone knocked at the door.', 'when', ['while', 'before', 'after']],
        ['______ I was reading, my sister was drawing.', 'While', ['Before', 'After', 'Until']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `先看时间状语：now / at this time yesterday / last Sunday 决定时态，本题应为 ${correct}。`,
      rows: [
        ["I was watching TV ______ eight o'clock last night.", 'at', ['on', 'in', 'for']],
        ['They visited the museum ______.', 'yesterday', ['now', 'tomorrow', 'next week']],
        ['Look! The children ______ football now.', 'are playing', ['were playing', 'played', 'play']],
        ['She ______ her homework at this time yesterday.', 'was doing', ['does', 'did', 'is doing']],
        ['My father came back ______.', 'last night', ['now', 'tomorrow', 'every day']],
        ['We ______ to the park last Sunday.', 'went', ['go', 'are going', 'will go']],
        ['At nine last night, he ______.', 'was sleeping', ['sleeps', 'slept', 'is sleeping']],
        ['The students ______ an English class now.', 'are having', ['were having', 'had', 'have']],
        ['It ______ heavily yesterday evening.', 'rained', ['rains', 'is raining', 'will rain']],
        ['While I ______ TV, my brother was doing his homework.', 'was watching', ['watched', 'watch', 'am watching']]
      ]
    }
  ])
}

// 现在完成时入门
function presentPerfectIntro() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `现在完成时结构为 have/has + 过去分词，本题正确形式是 ${correct}。`,
      rows: [
        ['I have ______ (finish) my homework.', 'finished', ['finish', 'finishing', 'finishes']],
        ['She has ______ (see) the film twice.', 'seen', ['see', 'saw', 'seeing']],
        ['We have ______ (be) to Beijing before.', 'been', ['be', 'being', 'was']],
        ['He has ______ (eat) breakfast already.', 'eaten', ['eat', 'ate', 'eating']],
        ['They have ______ (live) here for ten years.', 'lived', ['live', 'living', 'lives']],
        ['Tom has ______ (do) his homework.', 'done', ['do', 'did', 'doing']],
        ['My mother has ______ (buy) a new coat.', 'bought', ['buy', 'buying', 'buys']],
        ['I have ______ (write) a letter to my friend.', 'written', ['write', 'wrote', 'writing']],
        ['She has ______ (take) many photos.', 'taken', ['take', 'took', 'taking']],
        ['We have ______ (study) English for five years.', 'studied', ['study', 'studying', 'studies']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `since 后接时间点，for 后接时间段；本题应填 ${correct}。`,
      rows: [
        ['I have lived here ______ 2015.', 'since', ['for', 'from', 'at']],
        ['She has worked in the hospital ______ ten years.', 'for', ['since', 'from', 'at']],
        ['We have known each other ______ we were children.', 'since', ['for', 'from', 'at']],
        ['He has been ill ______ three days.', 'for', ['since', 'from', 'at']],
        ['They have been friends ______ last year.', 'since', ['for', 'from', 'at']],
        ['My father has worked in the factory ______ 20 years.', 'for', ['since', 'from', 'at']],
        ['I have learned English ______ I was ten.', 'since', ['for', 'from', 'at']],
        ['She has had this bike ______ two years.', 'for', ['since', 'from', 'at']],
        ['We have been here ______ half an hour.', 'for', ['since', 'from', 'at']],
        ['He has lived in Shanghai ______ he was born.', 'since', ['for', 'from', 'at']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `already 用于肯定句，yet 用于否定句和疑问句，ever 表示「曾经」，never 表示「从未」；本题应为 ${correct}。`,
      rows: [
        ['I have ______ finished my homework.', 'already', ['yet', 'ever', 'never']],
        ['Have you ______ been to the Great Wall?', 'ever', ['already', 'never', 'yet']],
        ["He has ______ seen the film, so he doesn't want to see it again.", 'already', ['yet', 'ever', 'never']],
        ["She hasn't finished her work ______.", 'yet', ['already', 'ever', 'never']],
        ['I have ______ eaten such delicious food.', 'never', ['already', 'ever', 'yet']],
        ['Have you finished your homework ______?', 'yet', ['already', 'ever', 'never']],
        ['They have ______ left. They are not here now.', 'already', ['yet', 'ever', 'never']],
        ['My sister has ______ been to Australia, so she knows little about it.', 'never', ['already', 'ever', 'yet']],
        ['— Have you ever read this book?\n— Yes, I have ______ read it twice.', 'already', ['yet', 'ever', 'never']],
        ["He hasn't come back ______.", 'yet', ['already', 'ever', 'never']]
      ]
    }
  ])
}

// 情态动词与被动语态
function modalsAndPassive() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `按情态动词的含义（必须、许可、能力、建议）判断，本题应为 ${correct}。`,
      rows: [
        ['Which word means "it is necessary to do something"? 哪个词表示「必须做某事」？（ ）', 'must', ['can', 'may', 'might']],
        ['— ______ I use your pen?\n— Sure, here you are.', 'May', ['Must', 'Should', 'Need']],
        ['You ______ be careful when you cross the road.', 'must', ['can', 'may', "needn't"]],
        ['— Can you swim?\n— Yes, I ______.', 'can', ['may', 'must', 'need']],
        ["You ______ not play football in the street. It's dangerous.", 'must', ['can', 'may', 'need']],
        ['______ you like to go with me?', 'Would', ['Must', 'Should', 'Need']],
        ['It ______ rain tomorrow. Take an umbrella.', 'may', ['must', 'need', "can't"]],
        ['You ______ worry about it. Everything will be fine.', "needn't", ["mustn't", "can't", "couldn't"]],
        ['— Must I finish it now?\n— No, you ______.', "needn't", ["mustn't", "can't", "won't"]],
        ['We ______ keep quiet in the library.', 'should', ['may', 'need', 'could']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `情态动词后必须接动词原形，本题应为 ${correct}。`,
      rows: [
        ['You must ______ (finish) your homework first.', 'finish', ['finishing', 'to finish', 'finished']],
        ['She can ______ (swim) very well.', 'swim', ['swims', 'swimming', 'to swim']],
        ['May I ______ (use) your phone?', 'use', ['to use', 'using', 'used']],
        ['We should ______ (help) each other.', 'help', ['helps', 'helping', 'to help']],
        ["You needn't ______ (worry) about the test.", 'worry', ['worried', 'worrying', 'to worry']],
        ['He must ______ (go) to bed before ten.', 'go', ['goes', 'going', 'went']],
        ['They can ______ (play) chess after school.', 'play', ['plays', 'playing', 'played']],
        ["You shouldn't ______ (eat) too much junk food.", 'eat', ['eats', 'eating', 'ate']],
        ['We must ______ (keep) the classroom clean.', 'keep', ['keeps', 'keeping', 'kept']],
        ['Can you ______ (speak) English?', 'speak', ['speaks', 'speaking', 'spoke']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `一般现在时被动语态结构为 am/is/are + 过去分词；本题应为 ${correct}。`,
      rows: [
        ['English ______ (speak) in many countries.', 'is spoken', ['speaks', 'is speaking', 'spoke']],
        ['The classroom ______ (clean) every day.', 'is cleaned', ['cleans', 'is cleaning', 'cleaned']],
        ['Rice ______ (grow) in the south of China.', 'is grown', ['grows', 'is growing', 'grew']],
        ['Football ______ (play) all over the world.', 'is played', ['plays', 'is playing', 'played']],
        ['Many trees ______ (plant) in our school every year.', 'are planted', ['is planted', 'plant', 'planted']],
        ['The books ______ (keep) in the library.', 'are kept', ['is kept', 'keep', 'kept']],
        ['Chinese food ______ (enjoy) by people all over the world.', 'is enjoyed', ['enjoys', 'is enjoying', 'enjoyed']],
        ['The windows ______ (clean) by Tom every week.', 'are cleaned', ['is cleaned', 'clean', 'cleaned']],
        ['The homework ______ (check) by the teacher every day.', 'is checked', ['checks', 'is checking', 'checked']],
        ['Letters ______ (send) by email today.', 'are sent', ['is sent', 'send', 'sent']]
      ]
    }
  ])
}

// 宾语从句入门
function objectClausesIntro() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `宾语从句必须用陈述语序（连接词 + 主语 + 谓语），本题应为 ${correct}。`,
      rows: [
        ['Could you tell me ______?', 'where he lives', ['where does he live', 'where he live', 'where did he live']],
        ["I don't know ______.", 'what he is doing', ['what is he doing', 'what does he do', 'what he doing']],
        ['Can you tell me ______?', 'when the train leaves', ['when does the train leave', 'when the train leave', 'when is the train leave']],
        ['She asked me ______.', 'why I was late', ['why was I late', 'why I am late', 'why were I late']],
        ['Do you know ______?', 'who he is', ['who is he', 'who does he', 'who he does']],
        ['I wonder ______.', 'how old he is', ['how old is he', 'how old he', 'what old he is']],
        ['Please tell me ______.', 'which bus I should take', ['which bus should I take', 'which bus I should took', 'which bus do I should take']],
        ["He didn't tell me ______.", 'where he was going', ['where was he going', 'where did he going', 'where he going']],
        ['I want to know ______.', 'if she likes music', ['if she like music', 'does she like music', 'if does she like music']],
        ['Let me know ______.', 'when you will come', ['when will you come', 'when you come will', 'when do you will come']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `陈述事实用 that，表示「是否」用 if/whether；本题应为 ${correct}。`,
      rows: [
        ["I don't know ______ or not he will come tomorrow.", 'whether', ['that', 'what', 'which']],
        ['She said ______ she was busy.', 'that', ['if', 'whether', 'what']],
        ['I wonder ______ it will rain.', 'if', ['that', 'what', 'which']],
        ['He asked me ______ I had finished my homework.', 'whether', ['that', 'what', 'who']],
        ['We know ______ the earth moves around the sun.', 'that', ['if', 'whether', 'what']],
        ["I don't care ______ he comes or not.", 'whether', ['that', 'what', 'which']],
        ['She told me ______ she would help me.', 'that', ['if', 'whether', 'what']],
        ['Do you know ______ she is at home?', 'if', ['that', 'what', 'which']],
        ["He didn't tell me ______ he would come or not.", 'whether', ['that', 'what', 'which']],
        ['I believe ______ he is honest.', 'that', ['if', 'whether', 'what']]
      ]
    },
    {
      difficulty: 3,
      dimension: 'transfer',
      hint: (correct, stem) => `主句是过去时，宾语从句通常用相应的过去时态；本题应为 ${correct}。`,
      rows: [
        ['She said (that) she ______ busy then.', 'was', ['is', 'will be', 'has been']],
        ['He told me he ______ to Beijing the year before.', 'had been', ['has been', 'was', 'will be']],
        ['I knew (that) he ______ in the library.', 'was', ['is', 'will be', 'has been']],
        ['She asked if I ______ free that afternoon.', 'was', ['am', 'will be', 'have been']],
        ['They said they ______ the film the next day.', 'would see', ['will see', 'saw', 'have seen']],
        ['He said he ______ his homework already.', 'had finished', ['has finished', 'will finish', 'finishes']],
        ['She said she ______ a doctor in the future.', 'would be', ['is', 'was', 'has been']],
        ['He told me that he ______ ill for two days.', 'had been', ['has been', 'was', 'is']],
        ["I didn't know when she ______ back.", 'would come', ['will come', 'comes', 'has come']],
        ['They said they ______ us the next week.', 'would visit', ['will visit', 'visited', 'have visited']]
      ]
    }
  ])
}

// 阅读理解策略
function readingComprehension() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `主旨题抓首句和关键词，本段主要讲「${correct}」。`,
      rows: [
        ['Many students like to study in the library because it is quiet. They can focus on their work there. 这段话主要讲的是（ ）', 'Studying in the library.', ['Playing in the library.', 'Borrowing books.', 'Cleaning the library.']],
        ['Bamboo grows very fast. In some places, it can grow one meter in a day. 这段话主要讲的是（ ）', 'Bamboo grows fast.', ['Bamboo is hard to find.', 'Bamboo is a kind of tree.', 'Bamboo has many leaves.']],
        ['The Spring Festival is an important festival in China. Families get together and have a big dinner. 这段话主要讲的是（ ）', 'The Spring Festival.', ['The Mid-Autumn Festival.', "Children's Day.", 'National Day.']],
        ['Washing hands before meals can keep us healthy. It helps us stay away from germs. 这段话主要讲的是（ ）', 'Washing hands for health.', ['Eating more fruit.', 'Doing exercise.', 'Sleeping early.']],
        ['More and more people go to work by bike. Riding a bike is good for health and the environment. 这段话主要讲的是（ ）', 'Riding bikes to work.', ['Driving cars to work.', 'Walking to school.', 'Taking the bus.']],
        ['The school sports meeting will be held next Friday. Students can take part in running, jumping and ball games. 这段话主要讲的是（ ）', 'The school sports meeting.', ['The school library.', 'The art festival.', 'The English club.']],
        ['Reading is a good hobby. It can open our eyes and make us think. 这段话主要讲的是（ ）', 'Reading is a good hobby.', ['Reading is difficult.', 'Reading takes time.', 'Reading is expensive.']],
        ['The old man gets up early every morning and waters the flowers in his garden. 这段话主要讲的是（ ）', "An old man's morning.", ["A young man's job.", 'A flower shop.', 'A big park.']],
        ['English is used in many countries. It is important for us to learn it well. 这段话主要讲的是（ ）', 'Learning English is important.', ['English is easy.', 'English is a subject.', 'English has many words.']],
        ['The weather in Kunming is warm all year round. Many people call it the Spring City. 这段话主要讲的是（ ）', "Kunming's weather.", ["Kunming's food.", "Kunming's history.", "Kunming's people."]]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `根据文中细节推断未直接写出的结论，本题可以推断「${correct}」。`,
      rows: [
        ['Tom looked at his watch and ran to the bus stop. 由此可以推断（ ）', 'Tom was in a hurry.', ['Tom was tired.', 'Tom was hungry.', 'Tom was lost.']],
        ["Lily didn't eat breakfast this morning. Now she feels very hungry. 由此可以推断（ ）", 'Lily is hungry.', ['Lily is full.', 'Lily is ill.', 'Lily is angry.']],
        ['The ground is wet. People are carrying umbrellas. 由此可以推断（ ）', 'It is raining.', ['It is snowing.', 'It is sunny.', 'It is windy.']],
        ["Mike's eyes are red and he keeps yawning. 由此可以推断（ ）", 'Mike is tired.', ['Mike is excited.', 'Mike is hungry.', 'Mike is angry.']],
        ['The children are wearing heavy coats and scarves. 由此可以推断（ ）', 'It is cold.', ['It is hot.', 'It is rainy.', 'It is windy.']],
        ['Amy got a gift from her mother. She jumped and smiled. 由此可以推断（ ）', 'Amy was happy.', ['Amy was sad.', 'Amy was afraid.', 'Amy was tired.']],
        ['The teacher looked at the noisy classroom and said nothing, but her face turned red. 由此可以推断（ ）', 'The teacher was angry.', ['The teacher was happy.', 'The teacher was ill.', 'The teacher was sleepy.']],
        ['Peter is looking out of the window all the time and counting the minutes. 由此可以推断（ ）', 'Peter wants the class to end.', ['Peter likes the class.', 'Peter is good at maths.', 'Peter is hungry.']],
        ['The shop has a sign that says Closed on the door, and the lights are off. 由此可以推断（ ）', 'The shop is not open.', ['The shop is busy.', 'The shop is new.', 'The shop is big.']],
        ['Jack ate three bowls of noodles and still asked for more. 由此可以推断（ ）', 'Jack was very hungry.', ['Jack was full.', 'Jack was ill.', 'Jack was angry.']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `连接词决定句间逻辑，本题表示「${correct}」。`,
      rows: [
        ['however 表示的逻辑关系是（ ）', '转折', ['因果', '并列', '条件']],
        ['therefore 表示的逻辑关系是（ ）', '结果', ['转折', '让步', '条件']],
        ['although 表示的逻辑关系是（ ）', '让步', ['原因', '结果', '并列']],
        ['because 表示的逻辑关系是（ ）', '原因', ['结果', '目的', '转折']],
        ['besides 表示的逻辑关系是（ ）', '递进', ['转折', '原因', '条件']],
        ['instead 表示的逻辑关系是（ ）', '替代', ['递进', '原因', '目的']],
        ['otherwise 表示的逻辑关系是（ ）', '否则', ['递进', '原因', '让步']],
        ['in order to 表示的逻辑关系是（ ）', '目的', ['原因', '结果', '转折']],
        ['for example 表示的逻辑关系是（ ）', '举例', ['因果', '转折', '让步']],
        ['so that 表示的逻辑关系是（ ）', '目的', ['原因', '转折', '条件']]
      ]
    }
  ])
}

// 书面表达组织
function writingOrganization() {
  return buildChapter([
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `主题句概括全段，其余句子是支持细节；本题主题句是「${correct}」。`,
      rows: [
        ['阅读下面三句话，选出最能概括全段的主题句：\n① We can read books about history.\n② Reading is a good hobby.\n③ We can also read stories.', '② Reading is a good hobby.', ['① We can read books about history.', '③ We can also read stories.', 'Reading is a way to spend money.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① I like swimming.\n② I also like drawing.\n③ I have a lot of hobbies.', '③ I have a lot of hobbies.', ['① I like swimming.', '② I also like drawing.', 'Hobbies take a lot of time.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① There are many flowers in it.\n② My school is beautiful.\n③ The playground is big.', '② My school is beautiful.', ['① There are many flowers in it.', '③ The playground is big.', 'My school is far from my home.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① I have four classes in the morning.\n② After school I have a piano lesson.\n③ Today is a busy day for me.', '③ Today is a busy day for me.', ['① I have four classes in the morning.', '② After school I have a piano lesson.', 'Piano lessons are interesting.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① Dogs are helpful animals.\n② They can help the police.\n③ They can guide the blind.', '① Dogs are helpful animals.', ['② They can help the police.', '③ They can guide the blind.', 'Dogs are afraid of strangers.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① Some listen to music.\n② Different people have different ways to relax.\n③ Others do sports.', '② Different people have different ways to relax.', ['① Some listen to music.', '③ Others do sports.', 'Music makes people happy.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① We should save water.\n② We should plant trees.\n③ It is important to protect the environment.', '③ It is important to protect the environment.', ['① We should save water.', '② We should plant trees.', 'Trees make the city green.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① Spring is my favourite season.\n② The weather is warm.\n③ Flowers come out everywhere.', '① Spring is my favourite season.', ['② The weather is warm.', '③ Flowers come out everywhere.', 'Spring is a good time to travel.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① We can shop online.\n② The Internet makes our life easier.\n③ We can study online.', '② The Internet makes our life easier.', ['① We can shop online.', '③ We can study online.', 'Online shopping is cheap.']],
        ['阅读下面三句话，选出最能概括全段的主题句：\n① We visited a farm.\n② We had a picnic there.\n③ Last weekend was unforgettable.', '③ Last weekend was unforgettable.', ['① We visited a farm.', '② We had a picnic there.', 'Farms are far from the city.']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `按句间逻辑选择连接词，本题应为 ${correct}。`,
      rows: [
        ['I like English. ______, I am good at it.', 'Besides', ['However', 'Because', 'Although']],
        ['It was raining. ______, we stayed at home.', 'Therefore', ['However', 'Although', 'Besides']],
        ['______ he is young, he knows a lot.', 'Although', ['Because', 'So', 'Besides']],
        ["She was ill. ______, she didn't go to school.", 'So', ['Although', 'Because', 'If']],
        ['I like fruit, ______ apples and bananas.', 'such as', ['however', 'because', 'so']],
        ['You should hurry up. ______, you will be late.', 'Otherwise', ['Besides', 'However', 'Therefore']],
        ["He didn't study hard. ______, he failed the exam.", 'As a result', ['Although', 'Besides', 'For example']],
        ['______ having a rest, he went on working.', 'Instead of', ['Because of', 'Although', 'In order to']],
        ['She gets up early every day ______ she can catch the first bus.', 'so that', ['although', 'because', 'however']],
        ['We should save water ______ it is important.', 'because', ['although', 'so', 'however']]
      ]
    },
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `按英语书面表达规范判断，本题应为「${correct}」。`,
      rows: [
        ['英语作文中，表示「首先」最常用的表达是（ ）', 'First of all', ['At last', 'In the end', 'By the way']],
        ['英语作文中，表示「最后」最常用的表达是（ ）', 'Finally', ['First', 'Besides', 'However']],
        ['英语作文中，表示「例如」的表达是（ ）', 'For example', ['However', 'Therefore', 'Although']],
        ['英语作文中，表示「总之」的表达是（ ）', 'In a word', ['For example', 'Besides', 'However']],
        ['给老师写英文邮件，开头称呼最恰当的是（ ）', 'Dear Mr. Li,', ['Hi Li,', 'Li,', 'Hello, Mr. Li']],
        ['英文正式书信结尾落款前常用（ ）', 'Yours sincerely,', ['Your friend,', 'Thanks a lot,', 'Bye']],
        ['书面表达中描述过去发生的事，应主要使用（ ）', '一般过去时', ['一般现在时', '一般将来时', '现在进行时']],
        ['写看图作文时，第一步通常是（ ）', '仔细观察图片，明确主题', ['直接抄写图片上的字', '先写结尾', '不用检查']],
        ['段落中用来支持主题句的句子叫（ ）', '支持句', ['主题句', '结尾句', '连接词']],
        ['一篇短文通常分为（ ）', '开头、主体、结尾三部分', ['两个部分', '四个部分', '五个部分']]
      ]
    }
  ])
}

export const bankGroup = {
  grade: '初二',
  subject: '英语',
  edition: '人教版',
  generators: {
    '一般过去时与过去进行时': pastAndPastContinuous,
    '现在完成时入门': presentPerfectIntro,
    '情态动词与被动语态': modalsAndPassive,
    '宾语从句入门': objectClausesIntro,
    '阅读理解策略': readingComprehension,
    '书面表达组织': writingOrganization
  }
}
