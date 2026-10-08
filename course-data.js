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
    ])
  ];

  const roadmap = [
    ['09', '过去发生的事', 'Vました／Vませんでした，描述昨天做过的事。'],
    ['10', '连接动作', 'て形，依次说明两个动作。'],
    ['11', '表达愿望', 'Vたいです／Nがほしいです。'],
    ['12', '比较与选择', 'より／ほうが，把两个选择放在一起。'],
    ['13', '许可和规则', 'てもいいです／てはいけません。'],
    ['14', '邀请与计划', 'ませんか／ましょう，安排下一次出行。']
  ].map(([number, title, goal]) => ({ number, title, goal }));

  const api = Object.freeze({ lessons: Object.freeze(lessons), roadmap: Object.freeze(roadmap) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CourseData = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
