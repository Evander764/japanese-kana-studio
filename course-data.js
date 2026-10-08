(function (root) {
  'use strict';

  // Original beginner examples. The published textbook outlines inform the
  // progression; no textbook dialogues or exercises are reproduced here.
  function lesson(id, chapter, title, goal, grammar, example, vocabulary, questions) {
    return {
      id, chapter, title, goal, grammar,
      example: { kana: example[0], romaji: example[1], meaning: example[2], kind: 'word', audio: 'audio/course-' + id + '-example.mp3' },
      vocabulary: vocabulary.map(([kana, romaji, meaning], index) => ({
        kana, romaji, meaning, kind: 'word', audio: 'audio/course-' + id + '-v' + (index + 1) + '.mp3'
      })),
      questions: questions.map((question, index) => ({
        ...question,
        id: id + '-q' + (index + 1),
        ...(question.type === 'listen' ? { audio: 'audio/course-' + id + '-listen.mp3' } : {})
      }))
    };
  }

  const lessons = [
    lesson('01', '先说出完整的一句', '介绍自己', '能说出身份，也能听懂“不是”。', [
      { pattern: 'N1 は N2 です', detail: '用 は 提出话题；这个助词写作「は」，读作 wa。句末 です 表示礼貌陈述。' },
      { pattern: 'N1 は N2 じゃありません', detail: '把 です 换成 じゃありません，表达“不是”。' }
    ], ['わたしは がくせいです。', 'watashi wa gakusei desu', '我是学生。'], [
      ['わたし', 'watashi', '我'], ['がくせい', 'gakusei', '学生'],
      ['せんせい', 'sensei', '老师'], ['かいしゃいん', 'kaishain', '公司职员']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'わたしは せんせいじゃありません。', options: ['我不是老师。', '我是老师。', '老师不在。'], answer: '我不是老师。', explain: 'じゃありません 是否定；は 在这里读 wa。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'わたし ＿ かいしゃいんです。', options: ['は', 'を', 'に'], answer: 'は', explain: '说自己的身份时，用 は 提出“我”这个话题。' },
      { type: 'order', prompt: '把词块排成“我是学生”。', tiles: ['がくせい', 'です', 'わたしは'], answer: 'わたしは がくせいです', explain: '话题在前：わたしは ＋ 身份 ＋ です。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'がくせい', answers: ['gakusei'], explain: 'がくせい读作 gakusei，意思是“学生”。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'わたしは かいしゃいんです。', options: ['我是公司职员。', '我是学生。', '我不是公司职员。'], answer: '我是公司职员。', explain: 'かいしゃいん是公司职员；です表示肯定。' }
    ]),
    lesson('02', '辨认人和物', '这本书是谁的', '能区分这、那，并说明物品属于谁。', [
      { pattern: 'これ / それ / あれ', detail: '分别指说话人近处、听话人近处、双方都远处的物品。' },
      { pattern: 'N1 の N2', detail: 'の 把两个名词连起来，可表示所属，如“我的书”。' }
    ], ['これは わたしの ほんです。', 'kore wa watashi no hon desu', '这是我的书。'], [
      ['ほん', 'hon', '书'], ['かさ', 'kasa', '伞'],
      ['かばん', 'kaban', '包'], ['ノート', 'nooto', '笔记本'],
      ['これ', 'kore', '这个']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'それは かさです。', options: ['那是伞。', '这是书。', '那是包。'], answer: '那是伞。', explain: 'それ指听话人附近的“那个”；かさ是伞。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'これは わたし ＿ ほんです。', options: ['の', 'が', 'を'], answer: 'の', explain: 'わたしの ほん表示“我的书”。' },
      { type: 'order', prompt: '把词块排成“那是我的包”。', tiles: ['かばんです', 'あれは', 'わたしの'], answer: 'あれは わたしの かばんです', explain: 'あれは ＋ 所属 ＋ 物品 ＋ です。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'かばん', answers: ['kaban'], explain: 'かばん读作 kaban，意思是“包”。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'これは ノートです。', options: ['这是笔记本。', '那是笔记本。', '这是伞。'], answer: '这是笔记本。', explain: 'これは指说话人近处的物品；ノート是笔记本。' }
    ]),
    lesson('03', '找到要去的地方', '车站在哪里', '能询问地点，并区分这里、那里和远处。', [
      { pattern: 'N は どこですか', detail: '询问某个地点在哪里。句尾 か 表示疑问。' },
      { pattern: 'ここ / そこ / あそこ', detail: '地点分别靠近说话人、听话人、或离双方都远。' }
    ], ['えきは あそこです。', 'eki wa asoko desu', '车站在远处那里。'], [
      ['えき', 'eki', '车站'], ['トイレ', 'toire', '洗手间'],
      ['としょかん', 'toshokan', '图书馆'], ['どこ', 'doko', '哪里'],
      ['ここ', 'koko', '这里']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'としょかんは ここです。', options: ['图书馆在这里。', '车站在那里。', '图书馆在哪里？'], answer: '图书馆在这里。', explain: 'ここ是说话人附近的“这里”。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'えき ＿ どこですか。', options: ['は', 'を', 'で'], answer: 'は', explain: '问车站在哪里：えきは どこですか。' },
      { type: 'order', prompt: '把词块排成“洗手间在远处”。', tiles: ['あそこ', 'です', 'トイレは'], answer: 'トイレは あそこです', explain: 'トイレは提出话题；あそこ指远处地点。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'としょかん', answers: ['toshokan', 'tosyokan'], explain: 'としょかん是图书馆；しょ可写作 sho 或 syo。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'トイレは そこです。', options: ['洗手间在你附近。', '图书馆在我附近。', '车站在远处。'], answer: '洗手间在你附近。', explain: 'そこ是听话人附近的“那里”。' }
    ]),
    lesson('04', '约定时间', '现在几点', '能说时间，也能看懂“从……开始”和“到……结束”。', [
      { pattern: 'いま なんじですか', detail: '询问现在的时间；じ 是“点”。' },
      { pattern: 'N は X から / Y までです', detail: 'から表示起点，まで表示终点。' }
    ], ['じゅぎょうは くじからです。', 'jugyou wa kuji kara desu', '课程从九点开始。'], [
      ['いま', 'ima', '现在'], ['なんじ', 'nanji', '几点'],
      ['くじ', 'kuji', '九点'], ['じゅうじ', 'juuji', '十点'],
      ['じゅぎょう', 'jugyou', '课程']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'いま じゅうじです。', options: ['现在十点。', '现在九点。', '十点开始。'], answer: '现在十点。', explain: 'じゅうじ是十点；いま是现在。' },
      { type: 'particle', prompt: '选一个词填空。', display: 'じゅぎょうは くじ ＿ です。', options: ['から', 'まで', 'の'], answer: 'から', explain: '九点开始，用 くじから。' },
      { type: 'order', prompt: '把词块排成“课程到十点结束”。', tiles: ['です', 'じゅうじまで', 'じゅぎょうは'], answer: 'じゅぎょうは じゅうじまでです', explain: 'まで标记时间的终点。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'なんじ', answers: ['nanji', 'nanzi'], explain: 'なんじ表示“几点”。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'じゅぎょうは くじからです。', options: ['课程从九点开始。', '课程到九点结束。', '现在十点。'], answer: '课程从九点开始。', explain: 'から是起点；くじ是九点。' }
    ]),
    lesson('05', '说日常动作', '喝茶与读书', '能说明做什么，也能说“不做”。', [
      { pattern: 'N を Vます', detail: 'を 标记动作的对象；写作「を」，通常读作 o。' },
      { pattern: 'Vません', detail: '把 ます 换成 ません，表示礼貌的否定。' }
    ], ['おちゃを のみます。', 'ocha o nomimasu', '喝茶。'], [
      ['おちゃ', 'ocha', '茶'], ['みず', 'mizu', '水'],
      ['ほん', 'hon', '书'], ['のみます', 'nomimasu', '喝'],
      ['よみます', 'yomimasu', '读']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'みずを のみません。', options: ['不喝水。', '喝水。', '不读书。'], answer: '不喝水。', explain: 'のみません是“（礼貌地说）不喝”。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'おちゃ ＿ のみます。', options: ['を', 'は', 'に'], answer: 'を', explain: '喝茶：おちゃを のみます。を 在这里读 o。' },
      { type: 'order', prompt: '把词块排成“我喝茶”。', tiles: ['のみます', 'おちゃを', 'わたしは'], answer: 'わたしは おちゃを のみます', explain: '话题在前，动作对象用 を 标出。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'よみます', answers: ['yomimasu'], explain: 'よみます表示“读”。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'ほんを よみます。', options: ['读书。', '买书。', '喝茶。'], answer: '读书。', explain: 'ほん是书；よみます是读。' }
    ]),
    lesson('06', '说出怎么去', '乘巴士去公园', '能表达目的地和交通工具。', [
      { pattern: '場所 へ いきます', detail: 'へ 标记移动方向；作助词时读作 e。' },
      { pattern: '交通工具 で いきます', detail: 'で 可以表示使用的交通工具。' }
    ], ['バスで えきへ いきます。', 'basu de eki e ikimasu', '乘巴士去车站。'], [
      ['バス', 'basu', '巴士'], ['でんしゃ', 'densha', '电车'],
      ['えき', 'eki', '车站'], ['こうえん', 'kouen', '公园'],
      ['いきます', 'ikimasu', '去']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'バスで えきへ いきます。', options: ['乘巴士去车站。', '在车站等巴士。', '乘电车去公园。'], answer: '乘巴士去车站。', explain: 'バスで表示交通工具；えきへ表示目的方向。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'でんしゃ ＿ こうえんへ いきます。', options: ['で', 'を', 'の'], answer: 'で', explain: '乘电车：でんしゃで。' },
      { type: 'order', prompt: '把词块排成“乘巴士去公园”。', tiles: ['いきます', 'こうえんへ', 'バスで'], answer: 'バスで こうえんへ いきます', explain: '交通工具 で ＋ 目的地 へ ＋ いきます。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'でんしゃ', answers: ['densha', 'densya'], explain: 'でんしゃ是电车；しゃ可写作 sha 或 sya。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'でんしゃで えきへ いきます。', options: ['乘电车去车站。', '乘巴士去车站。', '在车站喝茶。'], answer: '乘电车去车站。', explain: 'でんしゃ是电车；えき是车站。' }
    ]),
    lesson('07', '描述眼前的东西', '房间里有只猫', '能区分“有人或动物”和“有物品”。', [
      { pattern: '場所 に 人・動物 が います', detail: 'います用于人和动物；に指出存在的地点。' },
      { pattern: '場所 に 物 が あります', detail: 'あります用于一般物品。' }
    ], ['へやに ねこが います。', 'heya ni neko ga imasu', '房间里有猫。'], [
      ['ねこ', 'neko', '猫'], ['いぬ', 'inu', '狗'],
      ['へや', 'heya', '房间'], ['つくえ', 'tsukue', '桌子'],
      ['いす', 'isu', '椅子']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'へやに いぬが います。', options: ['房间里有狗。', '房间里有椅子。', '狗去了房间。'], answer: '房间里有狗。', explain: 'いぬ是狗；动物的存在用 います。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'へや ＿ ねこが います。', options: ['に', 'を', 'で'], answer: 'に', explain: '存在的地点用 に 标记。' },
      { type: 'order', prompt: '把词块排成“房间里有桌子”。', tiles: ['あります', 'へやに', 'つくえが'], answer: 'へやに つくえが あります', explain: '桌子是物品，用 あります。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'つくえ', answers: ['tsukue', 'tukue'], explain: 'つくえ是桌子；つ可写作 tsu 或 tu。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'へやに いすが あります。', options: ['房间里有椅子。', '房间里有猫。', '椅子在公园。'], answer: '房间里有椅子。', explain: 'いす是椅子；物品的存在用 あります。' }
    ]),
    lesson('08', '表达感受', '安静的小城', '能用常见形容词描述事物。', [
      { pattern: 'い形容詞 ＋ です', detail: 'おおきい、ちいさい、おいしい可直接接 です。' },
      { pattern: 'な形容詞 ＋ です', detail: 'しずか 描述名词时要加 な；句末说“安静”时是 しずかです。' }
    ], ['この まちは しずかです。', 'kono machi wa shizuka desu', '这座城很安静。'], [
      ['おおきい', 'ookii', '大的'], ['ちいさい', 'chiisai', '小的'],
      ['おいしい', 'oishii', '好吃的'], ['しずか', 'shizuka', '安静的'],
      ['まち', 'machi', '城镇'], ['ケーキ', 'keeki', '蛋糕']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'この へやは おおきいです。', options: ['这个房间很大。', '这个房间很小。', '这座城很安静。'], answer: '这个房间很大。', explain: 'おおきい表示“大”。' },
      { type: 'particle', prompt: '选一个助词填空。', display: 'この まち ＿ しずかです。', options: ['は', 'を', 'に'], answer: 'は', explain: '把“这座城”作为话题，用 は。' },
      { type: 'order', prompt: '把词块排成“这个包很小”。', tiles: ['ちいさいです', 'この', 'かばんは'], answer: 'この かばんは ちいさいです', explain: 'この接名词 かばん；ちいさい直接接 です。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'おいしい', answers: ['oishii', 'oisii'], explain: 'おいしい是“好吃”；し可写作 shi 或 si。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'この ケーキは おいしいです。', options: ['这个蛋糕很好吃。', '这个蛋糕很小。', '这座城很安静。'], answer: '这个蛋糕很好吃。', explain: 'ケーキ是蛋糕；おいしい是好吃。' }
    ]),
    lesson('09', '回顾昨天', '昨天做了什么', '能说过去做过什么，也能说过去没有做什么。', [
      { pattern: 'Vます → Vました', detail: '把ます换成ました，表示过去做过的动作：みます → みました（看了）。きのう表示“昨天”。' },
      { pattern: 'Vません → Vませんでした', detail: '过去的否定用ませんでした：のみませんでした表示“没有喝”。ません表示现在或将来的否定，要留意时间。' }
    ], ['きのうは えいがを みました。', 'kinou wa eiga o mimashita', '昨天看了电影。'], [
      ['きのう', 'kinou', '昨天'], ['えいが', 'eiga', '电影'],
      ['みました', 'mimashita', '看了'], ['よみました', 'yomimashita', '读了'],
      ['のみませんでした', 'nomimasen deshita', '没有喝']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'きのうは ほんを よみませんでした。', options: ['昨天没有读书。', '昨天读了书。', '今天不读书。'], answer: '昨天没有读书。', explain: 'きのう是昨天；よみませんでした是过去的否定，表示“没有读”。' },
      { type: 'particle', prompt: '补成“昨天没有喝水”。', display: 'きのうは みずを ＿。', options: ['のみませんでした', 'のみません', 'のみました'], answer: 'のみませんでした', explain: '“昨天没有喝”用过去否定のみませんでした；のみません是非过去否定。' },
      { type: 'order', prompt: '把词块排成“昨天看了电影”。', tiles: ['みました', 'きのうは', 'えいがを'], answer: 'きのうは えいがを みました', explain: 'きのうは提出时间话题，えいがを标记看的对象，みました表示看了。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'みました', answers: ['mimashita', 'mimasita'], explain: 'みました读作mimashita，意思是“看了”；し也可写作si。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'きのうは おちゃを のみました。', options: ['昨天喝了茶。', '昨天没有喝茶。', '今天喝茶。'], answer: '昨天喝了茶。', explain: 'きのう说明是昨天；のみました说明喝了，属于过去的肯定。' }
    ]),
    lesson('10', '按顺序说动作', '先吃早餐，再出门', '能用て形连接两个先后发生的动作。', [
      { pattern: 'Vて、Vます', detail: '本节用て形把动作连起来，表示“先……，再……”。前一个动词用て形，最后一个动词用ます结尾。' },
      { pattern: 'たべます → たべて', detail: '先记本节常用变化：たべます → たべて；のみます → のんで；よみます → よんで。て形也可能以で结尾，不能一律把ます换成て。' },
      { pattern: 'いきます → いって', detail: '其他常见变化：かいます → かって；かきます → かいて；はなします → はなして；します → して；きます → きて。いきます的て形是いって。' }
    ], ['あさごはんを たべて、えきへ いきます。', 'asagohan o tabete eki e ikimasu', '先吃早餐，再去车站。'], [
      ['あさごはん', 'asagohan', '早餐'], ['たべて', 'tabete', '吃：たべます的て形'],
      ['のんで', 'nonde', '喝：のみます的て形'], ['よんで', 'yonde', '读：よみます的て形'],
      ['いきます', 'ikimasu', '去']
    ], [
      { type: 'meaning', prompt: '这句话中，动作的顺序是什么？', display: 'おちゃを のんで、ほんを よみます。', options: ['先喝茶，再读书。', '先读书，再喝茶。', '不喝茶，也不读书。'], answer: '先喝茶，再读书。', explain: 'のんで是のみます的て形；本句先说喝茶，再说读书。' },
      { type: 'particle', prompt: '用“よみます”的て形补全句子。', display: 'ほんを ＿、えきへ いきます。', options: ['よんで', 'よみて', 'よみます'], answer: 'よんで', explain: 'よみます的て形是よんで。先读书，再去车站：ほんを よんで、えきへ いきます。' },
      { type: 'order', prompt: '把词块排成“先吃早餐，再喝茶”。', tiles: ['のみます', 'あさごはんを', 'たべて', 'おちゃを'], answer: 'あさごはんを たべて おちゃを のみます', explain: '前一个动作“吃”用たべて连接，最后一个动作“喝”用のみます结尾。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'のんで', answers: ['nonde'], explain: 'のんで读作nonde，是のみます（喝）的て形。' },
      { type: 'listen', prompt: '听发音，选择动作的顺序。', kana: 'ほんを よんで、こうえんへ いきます。', options: ['先读书，再去公园。', '先去公园，再读书。', '先喝茶，再去公园。'], answer: '先读书，再去公园。', explain: 'よんで是“读”的て形；こうえんへ いきます是去公园。' }
    ]),
    lesson('11', '说自己的愿望', '想看动画，想要自行车', '能区分“想做一件事”和“想要一件东西”。', [
      { pattern: 'Vます → Vたいです', detail: '去掉ます，接たいです：みます → みたいです（想看）；のみます → のみたいです（想喝）。本节表达自己的愿望。' },
      { pattern: 'N が ほしいです', detail: '想要物品时，用名词加が ほしいです；如かばんが ほしいです（想要包）。ほしい前面放物品，たい前面接动作。' }
    ], ['アニメを みたいです。', 'anime o mitai desu', '我想看动画。'], [
      ['アニメ', 'anime', '动画'], ['みたい', 'mitai', '想看'],
      ['ほしい', 'hoshii', '想要'], ['あたらしい', 'atarashii', '新的'],
      ['じてんしゃ', 'jitensha', '自行车']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'あたらしい かばんが ほしいです。', options: ['我想要一个新包。', '我有一个新包。', '我买了一个新包。'], answer: '我想要一个新包。', explain: 'あたらしい是新的；かばんが ほしいです表示想要包，尚未表示已经拥有。' },
      { type: 'particle', prompt: '补成“我想看动画”。', display: 'アニメを ＿です。', options: ['みたい', 'ほしい', 'みます'], answer: 'みたい', explain: 'みます去掉ます，接たい，得到みたい；みたいです表示想看。' },
      { type: 'order', prompt: '把词块排成“我想要一辆新自行车”。', tiles: ['ほしいです', 'あたらしい', 'じてんしゃが'], answer: 'あたらしい じてんしゃが ほしいです', explain: 'あたらしい修饰じてんしゃ；物品后接が ほしいです，表达想要。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'じてんしゃ', answers: ['jitensha', 'jitensya', 'zitensha', 'zitensya'], explain: 'じてんしゃ是自行车；じ可写作ji或zi，しゃ可写作sha或sya。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'おちゃを のみたいです。', options: ['我想喝茶。', '我不喝茶。', '我喝了茶。'], answer: '我想喝茶。', explain: 'のみたいです表示想喝；たい表达愿望，没有说明已经做过。' }
    ]),
    lesson('12', '在两个选择中比较', '电车和巴士，选哪个', '能听懂谁更快、哪个更便宜，避免把比较方向读反。', [
      { pattern: 'A は B より ～です', detail: 'より前面的B是比较基准，句子说明A比B更怎么样。でんしゃは バスより はやいです表示电车比巴士快。' },
      { pattern: 'A の ほうが B より ～です', detail: 'の ほうが突出比较中的A；A仍是更具有后面特征的一方。B より A の ほうが也是常见顺序。' }
    ], ['でんしゃは バスより はやいです。', 'densha wa basu yori hayai desu', '电车比巴士快。'], [
      ['はやい', 'hayai', '快的'], ['やすい', 'yasui', '便宜的'],
      ['バス', 'basu', '巴士'], ['でんしゃ', 'densha', '电车'],
      ['あの', 'ano', '那个：接名词，离双方都远']
    ], [
      { type: 'meaning', prompt: '这句话中，哪个更便宜？', display: 'バスは でんしゃより やすいです。', options: ['巴士比电车便宜。', '电车比巴士便宜。', '巴士比电车快。'], answer: '巴士比电车便宜。', explain: 'より前的でんしゃ是比较基准；话题バス是更便宜的一方。' },
      { type: 'particle', prompt: '补成“电车比巴士快”。', display: 'でんしゃは バス ＿ はやいです。', options: ['より', 'から', 'まで'], answer: 'より', explain: 'バスより表示“比巴士”；から和まで用于起点与终点，不表示比较。' },
      { type: 'order', prompt: '用“のほうが”排成“电车比巴士快”。', tiles: ['はやいです', 'バスより', 'でんしゃのほうが'], answer: 'でんしゃのほうが バスより はやいです', acceptedAnswers: ['バスより でんしゃのほうが はやいです'], explain: 'でんしゃのほうが突出电车；バスより给出比较基准。也可以把バスより放在でんしゃのほうが前面，意思不变。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'はやい', answers: ['hayai'], explain: 'はやい读作hayai，在本节表示“快”。' },
      { type: 'listen', prompt: '听发音，选择比较的结果。', kana: 'この かばんの ほうが あの かばんより やすいです。', options: ['这个包比那个包便宜。', '那个包比这个包便宜。', '这个包比那个包大。'], answer: '这个包比那个包便宜。', explain: 'この かばんの ほうが指出这个包；やすい表示便宜，比较基准是远处的那个包。' }
    ]),
    lesson('13', '先问许可，再看规则', '这里可以拍照吗', '能询问是否允许，也能听懂明确的禁止。', [
      { pattern: 'Vても いいです（か）', detail: '动词て形接も いいです，表示允许；句末加か就变成询问许可。とっても いいですか表示“可以拍吗”。' },
      { pattern: 'Vては いけません', detail: '动词て形接は いけません，表示禁止，语气比单纯说“不做”强。のんでは いけません表示“不允许喝”。' },
      { pattern: 'とります → とって', detail: '本节还用到はいります → はいって（进入）。ここで标记拍照等动作发生的地点；ここに はいります用に标记进入的地点。' }
    ], ['ここで しゃしんを とっても いいですか。', 'koko de shashin o tottemo ii desu ka', '可以在这里拍照吗？'], [
      ['しゃしん', 'shashin', '照片'], ['とって', 'totte', '拍：とります的て形'],
      ['ここ', 'koko', '这里'], ['のんで', 'nonde', '喝：のみます的て形'],
      ['はいって', 'haitte', '进入：はいります的て形']
    ], [
      { type: 'meaning', prompt: '这句话是什么意思？', display: 'ここで みずを のんでは いけません。', options: ['不允许在这里喝水。', '可以在这里喝水。', '刚才没有在这里喝水。'], answer: '不允许在这里喝水。', explain: 'のんで是喝的て形，接は いけません表示禁止；这句话说明规则，未描述过去的动作。' },
      { type: 'particle', prompt: '补成“可以拍照吗”。', display: 'しゃしんを とって ＿ いいですか。', options: ['も', 'は', 'を'], answer: 'も', explain: '询问许可用て形加も いいですか；禁止则用て形加は いけません。' },
      { type: 'order', prompt: '把词块排成“不允许在这里拍照”。', tiles: ['いけません', 'ここで', 'しゃしんを', 'とっては'], answer: 'ここで しゃしんを とっては いけません', acceptedAnswers: ['しゃしんを ここで とっては いけません'], explain: 'ここで说明地点，しゃしんを说明对象；とっては いけません表示禁止拍照。' },
      { type: 'read', prompt: '输入这个词的罗马字读音。', display: 'しゃしん', answers: ['shashin', 'syashin', 'shasin', 'syasin'], explain: 'しゃしん是照片；しゃ可写作sha或sya，し可写作shi或si。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'ここに はいっても いいです。', options: ['可以进入这里。', '不允许进入这里。', '可以进入这里吗？'], answer: '可以进入这里。', explain: 'はいっても いいです是允许进入；句末没有か，这里给出许可，而非提问。' }
    ]),
    lesson('14', '约下一次见面', '明天一起去公园吧', '能发出邀请，也能用“……吧”提议一起行动。', [
      { pattern: 'Vます → Vませんか', detail: '把ます换成ませんか，可以邀请别人一起做事，如いきませんか（一起去好吗）。本节的ませんか是邀请，要结合情境理解。' },
      { pattern: 'Vます → Vましょう', detail: '把ます换成ましょう，表示提议或响应邀请：いきましょう（一起去吧）；たべましょう（一起吃吧）。いっしょに表示“一起”。' }
    ], ['あした、いっしょに こうえんへ いきませんか。', 'ashita issho ni kouen e ikimasen ka', '明天一起去公园好吗？'], [
      ['あした', 'ashita', '明天'], ['いっしょに', 'issho ni', '一起'],
      ['いきませんか', 'ikimasen ka', '一起去好吗：邀请'], ['いきましょう', 'ikimashou', '一起去吧'],
      ['たべましょう', 'tabemashou', '一起吃吧']
    ], [
      { type: 'meaning', prompt: '朋友用这句话邀请你，是什么意思？', display: 'いっしょに おちゃを のみませんか。', options: ['一起喝茶好吗？', '我不喝茶。', '我们已经喝了茶。'], answer: '一起喝茶好吗？', explain: 'いっしょに说明一起行动；のみませんか在邀请情境中表示“一起喝好吗”。' },
      { type: 'particle', prompt: '补成邀请：“一起去公园好吗”。', display: 'いっしょに こうえんへ ＿。', options: ['いきませんか', 'いきません', 'いきました'], answer: 'いきませんか', explain: '邀请别人一起去，用いきませんか；いきません是“不去”，いきました是“去了”。' },
      { type: 'order', prompt: '把词块排成“明天一起去车站吧”。', tiles: ['いきましょう', 'あした', 'えきへ', 'いっしょに'], answer: 'あした いっしょに えきへ いきましょう', acceptedAnswers: ['あした えきへ いっしょに いきましょう', 'えきへ あした いっしょに いきましょう'], explain: '时间、一起和目的地可以调整顺序；句末いきましょう表示一起去吧。' },
      { type: 'read', prompt: '输入这个词组的罗马字读音。', display: 'いっしょに', answers: ['issho ni', 'issyo ni'], explain: 'いっしょに读作issho ni，意思是一起；っ让后面的辅音加倍，しょ也可写作syo。' },
      { type: 'listen', prompt: '听发音，选择句子的意思。', kana: 'いっしょに ケーキを たべましょう。', options: ['一起吃蛋糕吧。', '不一起吃蛋糕。', '一起去买蛋糕吧。'], answer: '一起吃蛋糕吧。', explain: 'ケーキ是蛋糕；たべましょう提议一起吃，没有表达购买。' }
    ])
  ];

  const enrichment = root.CourseEnrichment || (typeof require === 'function' ? require('./course-enrichment.js') : {});
  for (const entry of lessons) {
    const extra = enrichment[entry.id];
    if (!extra) continue;
    const originalWords = entry.vocabulary.length;
    entry.vocabulary.push(...extra.words.map(([kana, romaji, meaning], index) => ({
      kana, romaji, meaning, kind: 'word', audio: `audio/course-${entry.id}-v${originalWords + index + 1}.mp3`
    })));
    const [choiceExample, orderExample] = extra.examples;
    const orderTiles = orderExample[0];
    entry.examples = [
      entry.example,
      { kana: choiceExample[0], romaji: choiceExample[1], meaning: choiceExample[2], kind: 'word', audio: `audio/course-${entry.id}-example-2.mp3` },
      { kana: `${orderTiles.join(' ')}。`, romaji: orderExample[1], meaning: orderExample[2], kind: 'word', audio: `audio/course-${entry.id}-example-3.mp3` }
    ];
    const readWord = entry.vocabulary.find(word => word.kana === extra.read);
    if (!readWord) throw new Error(`Missing reading word for lesson ${entry.id}`);
    entry.questions.push(
      { id: `${entry.id}-q6`, type: 'meaning', prompt: '这句话是什么意思？', display: choiceExample[0], options: [choiceExample[2], choiceExample[3], choiceExample[4]], answer: choiceExample[2], explain: extra.note },
      { id: `${entry.id}-q7`, type: 'order', prompt: `把词块排成“${orderExample[2]}”`, tiles: [...orderTiles].reverse(), answer: orderTiles.join(' '), explain: extra.note },
      { id: `${entry.id}-q8`, type: 'read', prompt: '输入这个新词的罗马字读音。', display: readWord.kana, answers: [readWord.romaji], explain: `${readWord.kana}是“${readWord.meaning}”。` }
    );
  }

  const roadmap = [];

  const api = Object.freeze({ lessons: Object.freeze(lessons), roadmap: Object.freeze(roadmap) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CourseData = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
