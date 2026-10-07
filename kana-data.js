(function (root) {
  'use strict';

  // Kana and primary romanizations follow the Japan Foundation Irodori kana tables.
  // https://www.irodori.jpf.go.jp/assets/data/Kana_all.pdf
  const scripts = ['hiragana', 'katakana'];
  const items = [];

  function add(group, row, key, hira, kata, romaji, aliases = [], extra = {}) {
    for (const script of scripts) {
      items.push({
        id: `${script}:${group}:${key}`,
        script,
        group,
        row,
        key,
        kana: script === 'hiragana' ? hira : kata,
        pair: script === 'hiragana' ? kata : hira,
        romaji,
        aliases: [...new Set([romaji, ...aliases])],
        kind: group === 'special' ? 'word' : group === 'yoon' ? 'yoon' : 'single',
        audio: `audio/${group}-${key}.mp3`,
        ...extra
      });
    }
  }

  const basicRows = [
    ['あ行', [['a', 'あ', 'ア'], ['i', 'い', 'イ'], ['u', 'う', 'ウ'], ['e', 'え', 'エ'], ['o', 'お', 'オ']]],
    ['か行', [['ka', 'か', 'カ'], ['ki', 'き', 'キ'], ['ku', 'く', 'ク'], ['ke', 'け', 'ケ'], ['ko', 'こ', 'コ']]],
    ['さ行', [['sa', 'さ', 'サ'], ['shi', 'し', 'シ', ['si']], ['su', 'す', 'ス'], ['se', 'せ', 'セ'], ['so', 'そ', 'ソ']]],
    ['た行', [['ta', 'た', 'タ'], ['chi', 'ち', 'チ', ['ti']], ['tsu', 'つ', 'ツ', ['tu']], ['te', 'て', 'テ'], ['to', 'と', 'ト']]],
    ['な行', [['na', 'な', 'ナ'], ['ni', 'に', 'ニ'], ['nu', 'ぬ', 'ヌ'], ['ne', 'ね', 'ネ'], ['no', 'の', 'ノ']]],
    ['は行', [['ha', 'は', 'ハ'], ['hi', 'ひ', 'ヒ'], ['fu', 'ふ', 'フ', ['hu']], ['he', 'へ', 'ヘ'], ['ho', 'ほ', 'ホ']]],
    ['ま行', [['ma', 'ま', 'マ'], ['mi', 'み', 'ミ'], ['mu', 'む', 'ム'], ['me', 'め', 'メ'], ['mo', 'も', 'モ']]],
    ['や行', [['ya', 'や', 'ヤ'], ['yu', 'ゆ', 'ユ'], ['yo', 'よ', 'ヨ']]],
    ['ら行', [['ra', 'ら', 'ラ'], ['ri', 'り', 'リ'], ['ru', 'る', 'ル'], ['re', 'れ', 'レ'], ['ro', 'ろ', 'ロ']]],
    ['わ行', [['wa', 'わ', 'ワ'], ['wo', 'を', 'ヲ', ['o']], ['n', 'ん', 'ン', ['nn', "n'"]]]]
  ];
  for (const [row, cells] of basicRows) {
    for (const [romaji, hira, kata, aliases = []] of cells) add('base', row, romaji, hira, kata, romaji, aliases);
  }

  const voicedRows = [
    ['が行', [['ga', 'が', 'ガ'], ['gi', 'ぎ', 'ギ'], ['gu', 'ぐ', 'グ'], ['ge', 'げ', 'ゲ'], ['go', 'ご', 'ゴ']]],
    ['ざ行', [['za', 'ざ', 'ザ'], ['ji', 'じ', 'ジ', ['zi']], ['zu', 'ず', 'ズ'], ['ze', 'ぜ', 'ゼ'], ['zo', 'ぞ', 'ゾ']]],
    ['だ行', [['da', 'だ', 'ダ'], ['di', 'ぢ', 'ヂ', ['ji']], ['du', 'づ', 'ヅ', ['zu']], ['de', 'で', 'デ'], ['do', 'ど', 'ド']]],
    ['ば行', [['ba', 'ば', 'バ'], ['bi', 'び', 'ビ'], ['bu', 'ぶ', 'ブ'], ['be', 'べ', 'ベ'], ['bo', 'ぼ', 'ボ']]],
    ['ぱ行', [['pa', 'ぱ', 'パ'], ['pi', 'ぴ', 'ピ'], ['pu', 'ぷ', 'プ'], ['pe', 'ぺ', 'ペ'], ['po', 'ぽ', 'ポ']]]
  ];
  for (const [row, cells] of voicedRows) {
    for (const [romaji, hira, kata, aliases = []] of cells) add('voiced', row, romaji, hira, kata, romaji, aliases);
  }

  const yoonRows = [
    ['きゃ行', [['kya', 'きゃ', 'キャ'], ['kyu', 'きゅ', 'キュ'], ['kyo', 'きょ', 'キョ']]],
    ['しゃ行', [['sha', 'しゃ', 'シャ', ['sya']], ['shu', 'しゅ', 'シュ', ['syu']], ['sho', 'しょ', 'ショ', ['syo']]]],
    ['ちゃ行', [['cha', 'ちゃ', 'チャ', ['tya']], ['chu', 'ちゅ', 'チュ', ['tyu']], ['cho', 'ちょ', 'チョ', ['tyo']]]],
    ['にゃ行', [['nya', 'にゃ', 'ニャ'], ['nyu', 'にゅ', 'ニュ'], ['nyo', 'にょ', 'ニョ']]],
    ['ひゃ行', [['hya', 'ひゃ', 'ヒャ'], ['hyu', 'ひゅ', 'ヒュ'], ['hyo', 'ひょ', 'ヒョ']]],
    ['みゃ行', [['mya', 'みゃ', 'ミャ'], ['myu', 'みゅ', 'ミュ'], ['myo', 'みょ', 'ミョ']]],
    ['りゃ行', [['rya', 'りゃ', 'リャ'], ['ryu', 'りゅ', 'リュ'], ['ryo', 'りょ', 'リョ']]],
    ['ぎゃ行', [['gya', 'ぎゃ', 'ギャ'], ['gyu', 'ぎゅ', 'ギュ'], ['gyo', 'ぎょ', 'ギョ']]],
    ['じゃ行', [['ja', 'じゃ', 'ジャ', ['jya', 'zya']], ['ju', 'じゅ', 'ジュ', ['jyu', 'zyu']], ['jo', 'じょ', 'ジョ', ['jyo', 'zyo']]]],
    ['ぢゃ行', [['dya', 'ぢゃ', 'ヂャ', ['ja']], ['dyu', 'ぢゅ', 'ヂュ', ['ju']], ['dyo', 'ぢょ', 'ヂョ', ['jo']]]],
    ['びゃ行', [['bya', 'びゃ', 'ビャ'], ['byu', 'びゅ', 'ビュ'], ['byo', 'びょ', 'ビョ']]],
    ['ぴゃ行', [['pya', 'ぴゃ', 'ピャ'], ['pyu', 'ぴゅ', 'ピュ'], ['pyo', 'ぴょ', 'ピョ']]]
  ];
  for (const [row, cells] of yoonRows) {
    for (const [romaji, hira, kata, aliases = []] of cells) {
      add('yoon', row, romaji, hira, kata, romaji, aliases, {
        note: row === 'ぢゃ行' ? '较少使用；读音与じゃ行相近。' : ''
      });
    }
  }

  // Keep the displayed pronunciation distinct from a keyboard spelling.
  // The Irodori chart reads ヲ as o and ヂ/ヅ as ji/zu, while its input
  // instructions use wo and di/du to select those particular glyphs.
  const readingOverrides = {
    wo: ['o', '一般读作 o；输入 wo 可以明确选出这个字形。'],
    di: ['ji', '读音与「じ／ジ」相近；输入 di 可以明确选出这个字形。'],
    du: ['zu', '读音与「ず／ズ」相近；输入 du 可以明确选出这个字形。'],
    dya: ['ja', '较少使用；输入 dya 可以明确选出这个字形。'],
    dyu: ['ju', '较少使用；输入 dyu 可以明确选出这个字形。'],
    dyo: ['jo', '较少使用；输入 dyo 可以明确选出这个字形。']
  };
  for (const item of items) {
    const override = readingOverrides[item.key];
    if (!override) continue;
    item.romaji = override[0];
    item.aliases = [...new Set([override[0], ...item.aliases])];
    item.note = override[1];
  }

  const specialWords = [
    ['hiragana', '促音', 'kippu', 'きっぷ', ['kippu'], '小「っ」表示后面的辅音加倍。', '车票', 'き・停一拍・ぷ'],
    ['hiragana', '促音', 'gakki', 'がっき', ['gakki'], '小「っ」表示后面的辅音加倍。', '乐器', 'が・停一拍・き'],
    ['hiragana', '促音', 'asatte', 'あさって', ['asatte'], '小「っ」表示后面的辅音加倍。', '后天', 'あ・さ・停一拍・て'],
    ['hiragana', '促音', 'zasshi', 'ざっし', ['zasshi', 'zassi'], '小「っ」表示后面的辅音加倍。', '杂志', 'ざ・停一拍・し'],
    ['hiragana', '长音', 'obaasan', 'おばあさん', ['obaasan'], '平假名的长音可以用相邻元音表示。', '祖母；也可称年长女性', 'お・ば・あ（延长）・さ・ん'],
    ['hiragana', '长音', 'ojiisan', 'おじいさん', ['ojiisan'], '平假名的长音可以用相邻元音表示。', '祖父；也可称年长男性', 'お・じ・い（延长）・さ・ん'],
    ['hiragana', '长音', 'suuji', 'すうじ', ['suuji', 'suuzi'], '平假名的长音可以用相邻元音表示。', '数字', 'す・う（延长）・じ'],
    ['hiragana', '长音', 'oneesan', 'おねえさん', ['oneesan'], '平假名的长音可以用相邻元音表示。', '姐姐；也可称年轻女性', 'お・ね・え（延长）・さ・ん'],
    ['hiragana', '长音', 'koori', 'こおり', ['koori'], '「お」的长音有时写作「お」。', '冰', 'こ・お（延长）・り'],
    ['hiragana', '长音', 'hikouki', 'ひこうき', ['hikouki'], '「お」的长音有时写作「う」。', '飞机', 'ひ・こ・う（延长）・き'],
    ['katakana', '促音', 'koppu', 'コップ', ['koppu'], '小「ッ」表示后面的辅音加倍。', '杯子', 'コ・停一拍・プ'],
    ['katakana', '促音', 'beddo', 'ベッド', ['beddo'], '小「ッ」表示后面的辅音加倍。', '床', 'ベ・停一拍・ド'],
    ['katakana', '促音', 'torakku', 'トラック', ['torakku'], '小「ッ」表示后面的辅音加倍。', '卡车', 'ト・ラ・停一拍・ク'],
    ['katakana', '促音', 'suicchi', 'スイッチ', ['suicchi', 'suitti'], '小「ッ」表示后面的辅音加倍。', '开关', 'ス・イ・停一拍・チ'],
    ['katakana', '长音', 'kaaten', 'カーテン', ['kaaten'], '片假名常用「ー」标记长音。', '窗帘', 'カ・ー（延长）・テ・ン'],
    ['katakana', '长音', 'takushii', 'タクシー', ['takushii', 'takusii'], '片假名常用「ー」标记长音。', '出租车', 'タ・ク・シ・ー（延长）'],
    ['katakana', '长音', 'juusu', 'ジュース', ['juusu', 'jyuusu', 'zyuusu'], '片假名常用「ー」标记长音。', '果汁', 'ジュ・ー（延长）・ス'],
    ['katakana', '长音', 'keeki', 'ケーキ', ['keeki'], '片假名常用「ー」标记长音。', '蛋糕', 'ケ・ー（延长）・キ'],
    ['katakana', '长音', 'nooto', 'ノート', ['nooto'], '片假名常用「ー」标记长音。', '笔记本', 'ノ・ー（延长）・ト']
  ];
  for (const [script, row, key, kana, aliases, note, meaning, rhythm] of specialWords) {
    items.push({
      id: `${script}:special:${key}`,
      script, group: 'special', row, key, kana, pair: '',
      romaji: aliases[0], aliases, kind: 'word', note, meaning, rhythm,
      audio: `audio/special-${key}.mp3`
    });
  }

  const mixedExamples = [
    ['phrase-pan-taberu', 'パンをたべる', 'pan o taberu', '吃面包', 'パン是片假名外来语；を连接动作对象。', 'パ・ン・を・た・べ・る'],
    ['phrase-coohii-nomu', 'コーヒーをのむ', 'koohii o nomu', '喝咖啡', 'コーヒー是片假名外来语；のむ是平假名动词。', 'コー・ヒー・を・の・む'],
    ['phrase-basu-iku', 'バスでいく', 'basu de iku', '乘巴士去', 'で表示乘坐的交通工具；いく是平假名动词。', 'バ・ス・で・い・く'],
    ['phrase-hoteru-tomaru', 'ホテルにとまる', 'hoteru ni tomaru', '住酒店', 'に表示到达或停留的地点；とまる是平假名动词。', 'ホ・テ・ル・に・と・ま・る'],
    ['phrase-suupaa-kau', 'スーパーでかう', 'suupaa de kau', '在超市买', 'で表示动作发生的地点；かう是平假名动词。', 'スー・パー・で・か・う'],
    ['phrase-terebi-miru', 'テレビをみる', 'terebi o miru', '看电视', 'テレビ是片假名外来语；みる是平假名动词。', 'テ・レ・ビ・を・み・る'],
    ['phrase-takushii-noru', 'タクシーにのる', 'takushii ni noru', '乘出租车', 'に连接乘坐的对象；のる是平假名动词。', 'タ・ク・シー・に・の・る'],
    ['phrase-meeru-okuru', 'メールをおくる', 'meeru o okuru', '发送邮件', 'メール是片假名外来语；おくる是平假名动词。', 'メー・ル・を・お・く・る'],
    ['phrase-sumaho-shashin', 'スマホでしゃしんをとる', 'sumaho de shashin o toru', '用手机拍照片', 'しゃしん是平假名词；スマホ是片假名外来语。', 'ス・マ・ホ・で・しゃ・しん・を・と・る']
  ].map(([key, kana, romaji, meaning, note, rhythm]) => ({
    id: `mixed:special:${key}`,
    script: 'mixed', group: 'special', row: '平假名＋片假名短语', key, kana, pair: '',
    romaji, aliases: [romaji], kind: 'word', note, meaning, rhythm,
    audio: `audio/special-${key}.mp3`
  }));

  const api = Object.freeze({ items: Object.freeze(items), mixedExamples: Object.freeze(mixedExamples), scripts: Object.freeze(scripts) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KanaData = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
