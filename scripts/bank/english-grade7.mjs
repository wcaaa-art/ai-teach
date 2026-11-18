// 初一英语题库生成器：日常交际、一般现在时、名词代词、There be、一般过去时、阅读策略。
// 语法题由固定词形表和句框逐条生成；阅读题使用固定短文与唯一答案，避免歧义。
import { buildChapter } from './english-common.mjs'

// 日常交际与自我介绍
function dailyCommunication() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `根据问句判断交际场景，只有「${correct}」是针对该问句的恰当回答。`,
      rows: [
        ['— How are you?\n— ______', 'Fine, thank you.', ["I'm twelve.", "It's Monday.", 'Yes, I do.']],
        ['— What\'s your name?\n— ______', 'My name is Li Hua.', ["I'm thirteen.", "I'm from China.", "I'm in Class Two."]],
        ['— How old are you?\n— ______', "I'm thirteen years old.", ['My name is Tom.', "I'm from Canada.", "It's sunny today."]],
        ['— Where are you from?\n— ______', "I'm from China.", ["I'm twelve.", "I'm in Class One.", 'My name is Lily.']],
        ['— What class are you in?\n— ______', "I'm in Class Two, Grade Seven.", ["I'm from England.", "I'm thirteen.", "It's Monday."]],
        ['— Nice to meet you.\n— ______', 'Nice to meet you, too.', ["I'm fine.", 'Thank you.', 'See you.']],
        ['— Good morning, Miss Li.\n— ______', 'Good morning, Tom.', ['Good afternoon, Tom.', 'Good night, Tom.', 'Thank you.']],
        ['— How do you spell your name?\n— ______', 'L-I-H-U-A.', ['My name is Li Hua.', "I'm Li Hua.", 'Li Hua is my name.']],
        ['— What\'s your favourite subject?\n— ______', 'My favourite subject is English.', ["I'm in Class Three.", "I'm from Beijing.", "I'm thirteen."]],
        ['— Thank you very much.\n— ______', "You're welcome.", ["That's right.", "I'm fine.", 'See you.']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `先看对方说的是什么，再选对应的应答语；本题应选「${correct}」。`,
      rows: [
        ['— I\'m sorry I\'m late.\n— ______', "That's all right.", ["You're welcome.", 'Nice to meet you.', 'Thank you.']],
        ['— Goodbye! Have a nice day!\n— ______', 'Thank you. You too.', ["I'm fine.", "You're welcome.", "That's right."]],
        ['— May I use your pen?\n— ______', 'Sure, here you are.', ['Yes, I am.', 'No, thanks.', "That's right."]],
        ['— Would you like some tea?\n— ______', 'Yes, please.', ['Yes, I do.', "No, I don't.", "You're welcome."]],
        ['— Can you help me with my English?\n— ______', 'Of course.', ["You're welcome.", "That's right.", "I'm fine."]],
        ['— How\'s it going?\n— ______', 'Pretty good.', ["I'm thirteen.", "It's Monday.", "That's right."]],
        ['— Happy birthday!\n— ______', 'Thank you.', ["You're welcome.", 'See you.', "I'm fine."]],
        ['— Let\'s go to the library.\n— ______', 'Good idea.', ["You're welcome.", "I'm sorry.", 'Thank you.']],
        ['— Thanks for your help.\n— ______', 'My pleasure.', ["That's right.", "I'm fine.", 'See you.']],
        ['— Would you like to go with us?\n— ______', "I'd love to.", ["I'm fine.", "You're welcome.", "That's all right."]]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `按对话发生的地点与目的作答，本题的恰当回应是「${correct}」。`,
      rows: [
        ['— Hello! May I speak to Tom?\n— ______', 'This is Tom speaking.', ["I'm Tom.", 'Who are you?', 'Yes, I am Tom.']],
        ['— How much is this T-shirt?\n— ______', "It's fifty yuan.", ["It's on the desk.", "It's blue.", "It's mine."]],
        ['— Excuse me, how can I get to the zoo?\n— ______', 'Go along this street and turn left.', ["It's very big.", 'I like the zoo.', 'The zoo is free.']],
        ['— What would you like to eat?\n— ______', "I'd like some noodles.", ['I like noodles.', 'Yes, I do.', 'No, thanks.']],
        ['— What time does the class start?\n— ______', "At eight o'clock.", ['On Monday.', 'In the classroom.', 'For two hours.']],
        ['— What\'s the weather like today?\n— ______', "It's sunny.", ["It's Monday.", "It's eight.", "I'm fine."]],
        ['— What\'s the matter with you?\n— ______', 'I have a headache.', ["I'm a student.", "I'm thirteen.", 'I like sports.']],
        ['— How long can I keep the book?\n— ______', 'For two weeks.', ['Two books.', 'In the library.', 'Yes, you can.']],
        ['— Can I take a message?\n— ______', 'Yes. Please tell him to call me back.', ["No, I'm busy.", "You're welcome.", "I'm Tom."]],
        ['— Could you please open the window?\n— ______', "Sure, I'll do it right away.", ["You're welcome.", "That's right.", "I'm sorry."]]
      ]
    }
  ])
}

// 一般现在时
function presentSimple() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `一般现在时中主语是第三人称单数时，动词要用第三人称单数形式；本题应为 ${correct}。`,
      rows: [
        ['My sister ______ (go) to school by bike every day.', 'goes', ['go', 'going', 'went']],
        ['Tom ______ (watch) TV after dinner every evening.', 'watches', ['watch', 'watching', 'watched']],
        ['Lily ______ (study) English hard every day.', 'studies', ['study', 'studying', 'studied']],
        ['My brother ______ (have) a new bike.', 'has', ['have', 'having', 'had']],
        ['Jack ______ (do) his homework at home every night.', 'does', ['do', 'doing', 'did']],
        ['The bird ______ (fly) high in the sky.', 'flies', ['fly', 'flying', 'flew']],
        ['Miss Li ______ (teach) us English.', 'teaches', ['teach', 'teaching', 'taught']],
        ['My mother ______ (wash) the dishes after meals.', 'washes', ['wash', 'washing', 'washed']],
        ['He ______ (carry) a heavy bag every day.', 'carries', ['carry', 'carrying', 'carried']],
        ['Lucy ______ (play) the piano on Sundays.', 'plays', ['play', 'playing', 'played']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `主语是第三人称单数时用 doesn't，其余人称用 don't，后接动词原形；本题应为 ${correct}。`,
      rows: [
        ['Tom ______ like ice cream.', "doesn't", ["don't", "isn't", 'not']],
        ['They ______ go to school on Sundays.', "don't", ["doesn't", "aren't", 'not']],
        ['My father ______ watch TV in the morning.', "doesn't", ["don't", "isn't", 'not']],
        ['We ______ have any classes today.', "don't", ["doesn't", "aren't", 'not']],
        ['Lily ______ eat breakfast at home.', "doesn't", ["don't", "isn't", 'not']],
        ['The students ______ play football after class.', "don't", ["doesn't", "isn't", 'not']],
        ['It ______ snow in summer here.', "doesn't", ["don't", "isn't", 'not']],
        ['His parents ______ work in the same factory.', "don't", ["doesn't", "aren't", 'not']],
        ['She ______ know the answer.', "doesn't", ["don't", "isn't", 'not']],
        ['You ______ need to finish it today.', "don't", ["doesn't", "aren't", 'not']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `一般疑问句用助动词提问，主语为第三人称单数用 Does，其余用 Do，助动词后动词用原形；本题应为 ${correct}。`,
      rows: [
        ['______ your brother ______ (like) English?', 'Does; like', ['Do; like', 'Does; likes', 'Do; likes']],
        ['______ Lily ______ (walk) to school?', 'Does; walk', ['Do; walk', 'Does; walks', 'Do; walks']],
        ['______ the students ______ (play) basketball after school?', 'Do; play', ['Does; play', 'Do; plays', 'Does; plays']],
        ['______ your parents ______ (get) up early?', 'Do; get', ['Does; get', 'Do; gets', 'Does; gets']],
        ['______ Tom ______ (have) a sister?', 'Does; have', ['Do; have', 'Does; has', 'Do; has']],
        ['______ she ______ (do) her homework in the evening?', 'Does; do', ['Do; do', 'Does; does', 'Do; does']],
        ['______ they ______ (live) in Beijing?', 'Do; live', ['Does; live', 'Do; lives', 'Does; lives']],
        ['______ Mike ______ (watch) TV on weekends?', 'Does; watch', ['Do; watch', 'Does; watches', 'Do; watches']],
        ['______ his friends ______ (come) from Canada?', 'Do; come', ['Does; come', 'Do; comes', 'Does; comes']],
        ['______ your mother ______ (work) in a hospital?', 'Does; work', ['Do; work', 'Does; works', 'Do; works']]
      ]
    }
  ])
}

// 名词与代词
function nounsAndPronouns() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `根据名词复数变化规则，本题正确形式是 ${correct}。`,
      rows: [
        ['There are three ______ (box) on the desk.', 'boxes', ['boxs', 'boxies', 'box']],
        ['Two ______ (child) are playing under the tree.', 'children', ['childs', 'childrens', 'childes']],
        ['I need two ______ (knife) to cut fruit.', 'knives', ['knifes', 'knifves', 'knife']],
        ['Look at the two ______ (photo) on the wall.', 'photos', ['photoes', 'photo', 'photoies']],
        ['There are many ______ (tomato) in the basket.', 'tomatoes', ['tomatos', 'tomato', 'tomatoies']],
        ['Five ______ (sheep) are eating grass.', 'sheep', ['sheeps', 'sheepes', 'sheepies']],
        ['The two ______ (woman) are doctors.', 'women', ['womans', 'womens', 'woman']],
        ['My grandpa has many ______ (story) to tell.', 'stories', ['storys', 'storyes', 'story']],
        ['A cat has four ______ (foot).', 'feet', ['foots', 'feets', 'footes']],
        ['The ______ (mouse) are afraid of the cat.', 'mice', ['mouses', 'mices', 'mouse']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `名词所有格表示所属关系，本题应填 ${correct}。`,
      rows: [
        ['This is ______ (Tom) schoolbag.', "Tom's", ['Toms', "Toms'", 'Tom']],
        ['______ (Lucy) mother is an English teacher.', "Lucy's", ['Lucys', "Lucys'", 'Lucy']],
        ['The ______ (children) books are on the shelf.', "children's", ['childrens', "childrens'", 'children']],
        ['The two ______ (man) coats are black.', "men's", ['mans', 'mens', 'men']],
        ['This is ______ (Mr. Li) car.', "Mr. Li's", ['Mr. Lis', "Mr. Lis'", 'Mr. Li']],
        ['The ______ (women) room is on the second floor.', "women's", ['womans', 'womens', 'women']],
        ['It is about ten ______ (minute) walk from here.', "minutes'", ['minutes', "minute's", 'minute']],
        ['This is ______ (my father) bike.', "my father's", ['my fathers', "my fathers'", 'my father']],
        ['______ (Amy and Lily) bedroom is big and bright.', "Amy and Lily's", ['Amy and Lily', "Amy's and Lily", 'Amy and Lilys']],
        ['______ (Peter) bike is new.', "Peter's", ['Peters', "Peters'", 'Peter']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `按代词在句中的成分选择：作主语用主格，作宾语用宾格，表示所属用物主代词；本题应为 ${correct}。`,
      rows: [
        ['______ are my good friends.', 'They', ['Them', 'Their', 'Theirs']],
        ['This is my sister. ______ is a nurse.', 'She', ['Her', 'Hers', 'Herself']],
        ['Please give ______ the book.', 'me', ['I', 'my', 'mine']],
        ['We often play with ______.', 'him', ['he', 'his', 'himself']],
        ['______ is my English teacher.', 'He', ['Him', 'His', 'Himself']],
        ['Can you help ______?', 'us', ['we', 'our', 'ours']],
        ['The pens are ______.', 'theirs', ['they', 'them', 'their']],
        ['This is ______ book.', 'her', ['she', 'hers', 'herself']],
        ['______ am a middle school student.', 'I', ['Me', 'My', 'Mine']],
        ['The cat is licking ______ paw.', 'its', ['it', 'itself', "it's"]]
      ]
    }
  ])
}

// There be 句型
function thereBe() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `There be 句型遵循就近原则：be 动词与最靠近的名词在数上保持一致；本题应为 ${correct}。`,
      rows: [
        ['There ______ a book on the desk.', 'is', ['are', 'be', 'have']],
        ['There ______ two apples in the basket.', 'are', ['is', 'be', 'has']],
        ['There ______ some milk in the glass.', 'is', ['are', 'be', 'have']],
        ['There ______ many students in the classroom.', 'are', ['is', 'be', 'has']],
        ['There ______ a computer and two lamps in my room.', 'is', ['are', 'be', 'have']],
        ['There ______ two books and a pen on the desk.', 'are', ['is', 'be', 'has']],
        ['There ______ some water in the bottle.', 'is', ['are', 'be', 'have']],
        ['There ______ a lot of trees in the park.', 'are', ['is', 'be', 'has']],
        ['There ______ an English book and a dictionary in my bag.', 'is', ['are', 'be', 'have']],
        ['There ______ some boys playing football on the playground.', 'are', ['is', 'be', 'has']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `肯定句和表示邀请、请求的疑问句用 some，否定句和一般疑问句用 any；本题应为 ${correct}。`,
      rows: [
        ['There are ______ apples on the table.', 'some', ['any', 'a', 'much']],
        ['There isn\'t ______ milk in the fridge.', 'any', ['some', 'a', 'many']],
        ['Are there ______ birds in the tree?', 'any', ['some', 'a', 'much']],
        ['There is ______ bread on the plate.', 'some', ['any', 'many', 'a']],
        ['There aren\'t ______ students in the classroom now.', 'any', ['some', 'much', 'a']],
        ['Would you like ______ tea?', 'some', ['any', 'many', 'a']],
        ['Is there ______ water in the bottle?', 'any', ['some', 'many', 'a']],
        ['There are ______ flowers in the garden.', 'some', ['any', 'a', 'much']],
        ['There isn\'t ______ juice in the glass.', 'any', ['some', 'many', 'a']],
        ['There is ______ cheese on the plate.', 'some', ['any', 'many', 'a']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `改写 There be 句型的否定句时在 be 后加 not，疑问句把 be 提前，简答仍用 there be；本题应为 ${correct}。`,
      rows: [
        ['把「There is a park near here.」改为否定句：There ______ a park near here.', "isn't", ["aren't", 'not', 'is']],
        ['把「There are some books on the desk.」改为否定句：There ______ any books on the desk.', "aren't", ["isn't", 'not', 'are']],
        ['把「There is a library in our school.」改为一般疑问句：______ there a library in our school?', 'Is', ['Are', 'Do', 'Does']],
        ['把「There are two maps on the wall.」改为一般疑问句：______ there two maps on the wall?', 'Are', ['Is', 'Do', 'Does']],
        ['— Is there a zoo near here?\n— Yes, ______.', 'there is', ['it is', 'there are', 'they are']],
        ['— Are there any shops on this street?\n— No, ______.', "there aren't", ["there isn't", "they aren't", "it isn't"]],
        ['— Is there any water in the cup?\n— No, ______.', "there isn't", ["there aren't", "it isn't", "they aren't"]],
        ['— Are there two birds in the tree?\n— Yes, ______.', 'there are', ['there is', 'they are', 'it is']],
        ['把「There are some apples in the basket.」改为否定句：There ______ any apples in the basket.', "aren't", ["isn't", 'not', 'are']],
        ['把「There is some milk in the glass.」改为否定句：There ______ any milk in the glass.', "isn't", ["aren't", 'not', 'is']]
      ]
    }
  ])
}

// 一般过去时入门
function pastSimpleIntro() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `一般过去时表示过去发生的动作，规则动词加 -ed（注意双写和变 y 为 i）；本题应为 ${correct}。`,
      rows: [
        ['I ______ (visit) my grandparents last weekend.', 'visited', ['visit', 'visiting', 'visits']],
        ['They ______ (play) football yesterday afternoon.', 'played', ['play', 'playing', 'plays']],
        ['She ______ (study) English last night.', 'studied', ['study', 'studying', 'studies']],
        ['The bus ______ (stop) here ten minutes ago.', 'stopped', ['stop', 'stopping', 'stops']],
        ['We ______ (clean) the classroom last Friday.', 'cleaned', ['clean', 'cleaning', 'cleans']],
        ['Tom ______ (watch) a movie last Sunday.', 'watched', ['watch', 'watching', 'watches']],
        ['My mother ______ (cook) noodles for me yesterday.', 'cooked', ['cook', 'cooking', 'cooks']],
        ['He ______ (help) me with my homework last night.', 'helped', ['help', 'helping', 'helps']],
        ['They ______ (dance) at the party last night.', 'danced', ['dance', 'dancing', 'dances']],
        ['The children ______ (carry) water for the old man yesterday.', 'carried', ['carry', 'carrying', 'carries']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'basic-application',
      hint: (correct, stem) => `不规则动词的过去式需要单独记忆，本题正确形式是 ${correct}。`,
      rows: [
        ['I ______ (go) to the zoo with my parents yesterday.', 'went', ['go', 'going', 'goes']],
        ['She ______ (see) a film with her friends last night.', 'saw', ['see', 'seeing', 'seen']],
        ['We ______ (eat) noodles for lunch yesterday.', 'ate', ['eat', 'eaten', 'eating']],
        ['He ______ (buy) a new bike last week.', 'bought', ['buy', 'buying', 'buys']],
        ['They ______ (take) photos in the park last Sunday.', 'took', ['take', 'taken', 'taking']],
        ['My father ______ (have) a meeting yesterday.', 'had', ['have', 'has', 'having']],
        ['She ______ (do) her homework last night.', 'did', ['do', 'does', 'done']],
        ['Lily ______ (come) to school late yesterday.', 'came', ['come', 'coming', 'comes']],
        ['He ______ (make) a model plane last week.', 'made', ['make', 'making', 'maked']],
        ['My uncle ______ (give) me a book yesterday.', 'gave', ['give', 'given', 'giving']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `一般过去时的否定句用 didn't + 动词原形，疑问句用 Did 开头，简答也用 did；本题应为 ${correct}。`,
      rows: [
        ['Tom ______ go to the zoo yesterday.', "didn't", ["doesn't", "don't", "wasn't"]],
        ['— ______ you watch TV last night?\n— Yes, I did.', 'Did', ['Do', 'Does', 'Are']],
        ['— Did she visit her grandma last Sunday?\n— No, she ______.', "didn't", ["doesn't", "don't", "isn't"]],
        ['We ______ have a party last week.', "didn't", ["doesn't", "don't", "weren't"]],
        ['His sister ______ do her homework last night.', "didn't", ["doesn't", "don't", "isn't"]],
        ['— ______ he play football yesterday?\n— Yes, he did.', 'Did', ['Do', 'Does', 'Is']],
        ['— Did they finish the work?\n— Yes, they ______.', 'did', ['do', 'does', 'are']],
        ['My mother ______ cook dinner yesterday.', "didn't", ["doesn't", "don't", "wasn't"]],
        ['— ______ your father go to Beijing last week?\n— No, he didn\'t.', 'Did', ['Do', 'Does', 'Is']],
        ['I ______ see him at school yesterday.', "didn't", ["doesn't", "don't", "wasn't"]]
      ]
    }
  ])
}

// 阅读策略与语篇理解
function readingStrategies() {
  return buildChapter([
    {
      difficulty: 1,
      dimension: 'concept',
      hint: (correct, stem) => `根据上下文提供的原因、结果或解释线索推断词义；本题应为「${correct}」。`,
      rows: [
        ['Tom was very hungry after the long walk, so he ate three bowls of rice. 句中 hungry 的意思是（ ）', '饿的', ['口渴的', '疲倦的', '生病的']],
        ['The bottle is empty. There is no water in it. 句中 empty 的意思是（ ）', '空的', ['满的', '干净的', '破的']],
        ['It is raining hard, so please take an umbrella with you. 句中 umbrella 的意思是（ ）', '雨伞', ['雨衣', '帽子', '书包']],
        ['My grandpa is over eighty, but he is still strong and can carry heavy things. 句中 strong 的意思是（ ）', '强壮的', ['瘦弱的', '年轻的', '安静的']],
        ['The students are quiet in the library. Nobody is talking. 句中 quiet 的意思是（ ）', '安静的', ['吵闹的', '兴奋的', '紧张的']],
        ['Lily got a new bike on her birthday. She was very happy and smiled all day. 句中 happy 的意思是（ ）', '开心的', ['难过的', '生气的', '害怕的']],
        ['The train leaves at 8:00, so we must arrive at the station before 7:40. 句中 arrive 的意思是（ ）', '到达', ['离开', '出发', '经过']],
        ['It is very cold outside. Please put on your coat. 句中 cold 的意思是（ ）', '寒冷的', ['炎热的', '温暖的', '凉爽的']],
        ['The little boy is afraid of the big dog and hides behind his mother. 句中 afraid 的意思是（ ）', '害怕的', ['喜欢的', '讨厌的', '好奇的']],
        ['The cake is delicious. Everyone wants to eat more. 句中 delicious 的意思是（ ）', '美味的', ['难吃的', '昂贵的', '便宜的']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'method',
      hint: (correct, stem) => `代词指代前文出现过的人或物，结合上下句判断；本题指代「${correct}」。`,
      rows: [
        ['Lucy and Lily are twins. They are in the same class. 句中 They 指代的是（ ）', 'Lucy and Lily', ["Lucy's sister", 'their teacher', "the twins' mother"]],
        ['I have a cat. It is white and black. 句中 It 指代的是（ ）', 'the cat', ['the dog', 'the colour', 'the house']],
        ['Tom bought a book and gave it to his sister. 句中 it 指代的是（ ）', 'the book', ['his sister', 'Tom', 'the shop']],
        ['Mr. Li is our English teacher. He is very kind. 句中 He 指代的是（ ）', 'Mr. Li', ['our English book', 'the student', 'Tom']],
        ['The children are playing football. Their parents are watching them. 句中 them 指代的是（ ）', 'the children', ['the parents', 'the teachers', 'the balls']],
        ['Mary lost her pen, but she found it under the desk. 句中 it 指代的是（ ）', 'her pen', ['the desk', 'Mary', 'the classroom']],
        ['My brother and I like swimming. We go swimming every Sunday. 句中 We 指代的是（ ）', 'my brother and I', ['my parents', 'my brother', 'my friends']],
        ['The girls are singing. Their teacher is playing the piano for them. 句中 them 指代的是（ ）', 'the girls', ['the teachers', 'the songs', 'the parents']],
        ['Peter has a new bike. He rides it to school every day. 句中 it 指代的是（ ）', 'his new bike', ['Peter', 'the school', 'his bag']],
        ['The book is very interesting. I read it twice. 句中 it 指代的是（ ）', 'the book', ['the story', 'the writer', 'the library']]
      ]
    },
    {
      difficulty: 2,
      dimension: 'transfer',
      hint: (correct, stem) => `主旨题看首句和反复出现的关键信息，本段主要讲「${correct}」。`,
      rows: [
        ['Dogs are our good friends. They can help people in many ways, such as guarding the house and guiding the blind. 这段话主要讲的是（ ）', 'Dogs are helpful to people.', ['Dogs are afraid of people.', 'Dogs like to play with cats.', 'Dogs are hard to keep.']],
        ['Every morning, Li Ming gets up at six, runs for half an hour, and then reads English. 这段话主要讲的是（ ）', "Li Ming's morning routine.", ["Li Ming's favourite food.", "Li Ming's school.", "Li Ming's friends."]],
        ['The library is a quiet place. People can borrow books and read there. 这段话主要讲的是（ ）', 'The library.', ['The playground.', 'The bookstore.', 'The classroom.']],
        ['Spring is warm and flowers come out. Many people like flying kites in spring. 这段话主要讲的是（ ）', 'Spring.', ['Summer.', 'Autumn.', 'Winter.']],
        ['My school is big and beautiful. There are many trees and a big playground in it. 这段话主要讲的是（ ）', 'My school.', ['My home.', 'My garden.', 'My classroom.']],
        ['Water is important to us. We should save water in our daily life. 这段话主要讲的是（ ）', 'Saving water.', ['Drinking milk.', 'Planting trees.', 'Saving money.']],
        ['The panda is a lovely animal. It lives in China and eats bamboo. 这段话主要讲的是（ ）', 'The panda.', ['The tiger.', 'The monkey.', 'The elephant.']],
        ['Tom likes sports. He plays basketball after school every day. 这段话主要讲的是（ ）', "Tom's hobby.", ["Tom's school.", "Tom's family.", "Tom's homework."]],
        ['The shop sells school things like pens, books and rulers. 这段话主要讲的是（ ）', 'A shop for school things.', ['A shop for clothes.', 'A shop for food.', 'A shop for toys.']],
        ['It is Sunday. The children are helping their mother do housework at home. 这段话主要讲的是（ ）', 'Helping with housework.', ['Playing in the park.', 'Doing homework.', 'Watching TV.']]
      ]
    }
  ])
}

export const bankGroup = {
  grade: '初一',
  subject: '英语',
  edition: '人教版',
  generators: {
    '日常交际与自我介绍': dailyCommunication,
    '一般现在时': presentSimple,
    '名词与代词': nounsAndPronouns,
    'There be 句型': thereBe,
    '一般过去时入门': pastSimpleIntro,
    '阅读策略与语篇理解': readingStrategies
  }
}
