(function (root) {
  'use strict';

  // Original, chapter-specific additions. Each entry has twelve words,
  // two usable example sentences, and the material for three more questions.
  const data = {
    '01': {
      words: [
        ['あなた', 'anata', '你'], ['ともだち', 'tomodachi', '朋友'], ['なまえ', 'namae', '名字'],
        ['にほん', 'nihon', '日本'], ['ちゅうごく', 'chuugoku', '中国'], ['にほんじん', 'nihonjin', '日本人'],
        ['ちゅうごくじん', 'chuugokujin', '中国人'], ['だいがくせい', 'daigakusei', '大学生'],
        ['いしゃ', 'isha', '医生'], ['かんごし', 'kangoshi', '护士'], ['エンジニア', 'enjinia', '工程师'], ['ひと', 'hito', '人']
      ],
      examples: [
        ['わたしは だいがくせいです。', 'watashi wa daigakusei desu', '我是大学生。', '我不是大学生。', '你是老师。'],
        [['ともだちは', 'エンジニアです'], 'tomodachi wa enjinia desu', '朋友是工程师。']
      ],
      read: 'なまえ', note: 'は提出谈论的人；后面接身份，再用です礼貌地结束。'
    },
    '02': {
      words: [
        ['それ', 'sore', '那个：靠近听话人'], ['あれ', 'are', '那个：离双方都远'],
        ['この', 'kono', '这个：接名词'], ['その', 'sono', '那个：接名词，靠近听话人'],
        ['あの', 'ano', '那个：接名词，离双方都远'], ['だれ', 'dare', '谁'],
        ['じしょ', 'jisho', '词典'], ['えんぴつ', 'enpitsu', '铅笔'], ['ペン', 'pen', '笔'],
        ['けしゴム', 'keshigomu', '橡皮'], ['くつ', 'kutsu', '鞋'], ['かぎ', 'kagi', '钥匙']
      ],
      examples: [
        ['それは だれの かぎですか。', 'sore wa dare no kagi desu ka', '那是谁的钥匙？', '那是我的钥匙。', '这是谁的书？'],
        [['この', 'ペンは', 'わたしのです'], 'kono pen wa watashi no desu', '这支笔是我的。']
      ],
      read: 'かぎ', note: 'これ可单独指“这个”；この要放在名词前，の可表示所属。'
    },
    '03': {
      words: [
        ['そこ', 'soko', '那里：靠近听话人'], ['あそこ', 'asoko', '那里：离双方都远'],
        ['こちら', 'kochira', '这边'], ['みぎ', 'migi', '右边'], ['ひだり', 'hidari', '左边'],
        ['まえ', 'mae', '前面'], ['うしろ', 'ushiro', '后面'], ['となり', 'tonari', '旁边'],
        ['がっこう', 'gakkou', '学校'], ['びょういん', 'byouin', '医院'],
        ['ぎんこう', 'ginkou', '银行'], ['スーパー', 'suupaa', '超市']
      ],
      examples: [
        ['ぎんこうは どこですか。', 'ginkou wa doko desu ka', '银行在哪里？', '银行在这里。', '医院在哪里？'],
        [['スーパーは', 'あそこです'], 'suupaa wa asoko desu', '超市在那边。']
      ],
      read: 'みぎ', note: 'どこ用于问地点；ここ、そこ、あそこ分别取决于说话双方的位置。'
    },
    '04': {
      words: [
        ['いちじ', 'ichiji', '一点'], ['にじ', 'niji', '两点'], ['さんじ', 'sanji', '三点'],
        ['よじ', 'yoji', '四点'], ['ごじ', 'goji', '五点'], ['ろくじ', 'rokuji', '六点'],
        ['しちじ', 'shichiji', '七点'], ['はちじ', 'hachiji', '八点'],
        ['なんぷん', 'nanpun', '几分'], ['はん', 'han', '半；三十分'],
        ['あさ', 'asa', '早上'], ['よる', 'yoru', '夜晚']
      ],
      examples: [
        ['いまは はちじはんです。', 'ima wa hachiji han desu', '现在是八点半。', '现在是八点。', '现在是九点半。'],
        [['じゅぎょうは', 'よじまでです'], 'jugyou wa yoji made desu', '课上到四点。']
      ],
      read: 'よじ', note: '四点说よじ；はん表示半点，から表示起点，まで表示终点。'
    },
    '05': {
      words: [
        ['たべます', 'tabemasu', '吃'], ['かいます', 'kaimasu', '买'], ['みます', 'mimasu', '看'],
        ['ききます', 'kikimasu', '听'], ['かきます', 'kakimasu', '写'], ['します', 'shimasu', '做'],
        ['コーヒー', 'koohii', '咖啡'], ['ごはん', 'gohan', '饭'], ['パン', 'pan', '面包'],
        ['りんご', 'ringo', '苹果'], ['しんぶん', 'shinbun', '报纸'], ['てがみ', 'tegami', '信']
      ],
      examples: [
        ['あさは パンを たべます。', 'asa wa pan o tabemasu', '早上吃面包。', '早上不吃面包。', '晚上喝咖啡。'],
        [['しんぶんを', 'よみません'], 'shinbun o yomimasen', '不读报纸。']
      ],
      read: 'りんご', note: '动作对象后用を；动词ます形可换成ません表示“不做”。'
    },
    '06': {
      words: [
        ['あるきます', 'arukimasu', '走路'], ['じてんしゃ', 'jitensha', '自行车'],
        ['タクシー', 'takushii', '出租车'], ['くるま', 'kuruma', '汽车'],
        ['ちかてつ', 'chikatetsu', '地铁'], ['ひこうき', 'hikouki', '飞机'],
        ['がっこう', 'gakkou', '学校'], ['うち', 'uchi', '家'], ['みせ', 'mise', '商店'],
        ['かえります', 'kaerimasu', '回去'], ['きます', 'kimasu', '来'], ['まっすぐ', 'massugu', '直走']
      ],
      examples: [
        ['じてんしゃで がっこうへ いきます。', 'jitensha de gakkou e ikimasu', '骑自行车去学校。', '步行去学校。', '骑自行车回家。'],
        [['タクシーで', 'うちへ', 'かえります'], 'takushii de uchi e kaerimasu', '乘出租车回家。']
      ],
      read: 'うち', note: '交通工具后用で；目的方向后用へ，作助词时读作e。'
    },
    '07': {
      words: [
        ['こども', 'kodomo', '孩子'], ['おとこ', 'otoko', '男性'], ['おんな', 'onna', '女性'],
        ['さかな', 'sakana', '鱼'], ['とり', 'tori', '鸟'], ['ベッド', 'beddo', '床'],
        ['ドア', 'doa', '门'], ['まど', 'mado', '窗户'], ['でんわ', 'denwa', '电话'],
        ['テレビ', 'terebi', '电视'], ['ほんだな', 'hondana', '书架'], ['にわ', 'niwa', '院子']
      ],
      examples: [
        ['にわに とりが います。', 'niwa ni tori ga imasu', '院子里有鸟。', '院子里有桌子。', '房间里有鸟。'],
        [['へやに', 'テレビが', 'あります'], 'heya ni terebi ga arimasu', '房间里有电视。']
      ],
      read: 'まど', note: '人和动物用います；一般物品用あります；地点后用に。'
    },
    '08': {
      words: [
        ['あつい', 'atsui', '热的'], ['さむい', 'samui', '冷的'],
        ['たかい', 'takai', '高的；贵的'], ['ひくい', 'hikui', '低的'],
        ['きれい', 'kirei', '漂亮的；干净的'], ['にぎやか', 'nigiyaka', '热闹的'],
        ['べんり', 'benri', '方便的'], ['むずかしい', 'muzukashii', '难的'],
        ['やさしい', 'yasashii', '容易的；温柔的'], ['たのしい', 'tanoshii', '开心的'],
        ['つまらない', 'tsumaranai', '无聊的'], ['あまい', 'amai', '甜的']
      ],
      examples: [
        ['この まちは にぎやかです。', 'kono machi wa nigiyaka desu', '这座城很热闹。', '这座城很安静。', '这座城很小。'],
        [['この', 'ケーキは', 'あまいです'], 'kono keeki wa amai desu', '这个蛋糕很甜。']
      ],
      read: 'あまい', note: 'にぎやか是な形容词；あまい是い形容词，都能在句末接です。'
    },
    '09': {
      words: [
        ['おととい', 'ototoi', '前天'], ['せんしゅう', 'senshuu', '上周'],
        ['せんげつ', 'sengetsu', '上个月'], ['いきました', 'ikimashita', '去了'],
        ['きました', 'kimashita', '来了'], ['たべました', 'tabemashita', '吃了'],
        ['かいました', 'kaimashita', '买了'], ['ききました', 'kikimashita', '听了'],
        ['しました', 'shimashita', '做了'], ['みませんでした', 'mimasen deshita', '没有看'],
        ['たべませんでした', 'tabemasen deshita', '没有吃'], ['かえりました', 'kaerimashita', '回去了']
      ],
      examples: [
        ['せんしゅうは えいがを みませんでした。', 'senshuu wa eiga o mimasen deshita', '上周没有看电影。', '上周看了电影。', '昨天没有看电影。'],
        [['きのうは', 'パンを', 'たべました'], 'kinou wa pan o tabemashita', '昨天吃了面包。']
      ],
      read: 'おととい', note: '过去肯定用ました，过去否定用ませんでした；时间词帮助确定时态。'
    },
    '10': {
      words: [
        ['おきて', 'okite', '起床：おきます的て形'], ['あらって', 'aratte', '洗：あらいます的て形'],
        ['かいて', 'kaite', '写：かきます的て形'], ['きいて', 'kiite', '听：ききます的て形'],
        ['かって', 'katte', '买：かいます的て形'], ['まって', 'matte', '等：まちます的て形'],
        ['はなして', 'hanashite', '说：はなします的て形'], ['して', 'shite', '做：します的て形'],
        ['きて', 'kite', '来：きます的て形'], ['いって', 'itte', '去：いきます的て形'],
        ['でかけます', 'dekakemasu', '出门'], ['しごと', 'shigoto', '工作']
      ],
      examples: [
        ['あさ おきて、かおを あらいます。', 'asa okite kao o araimasu', '早上起床，然后洗脸。', '早上洗脸，然后起床。', '晚上起床，然后洗脸。'],
        [['パンを', 'かって', 'うちへ', 'かえります'], 'pan o katte uchi e kaerimasu', '买面包，然后回家。']
      ],
      read: 'まって', note: 'て形放在前一个动作后面；最后一个动作仍用ます形结束。'
    },
    '11': {
      words: [
        ['たべたい', 'tabetai', '想吃'], ['のみたい', 'nomitai', '想喝'],
        ['いきたい', 'ikitai', '想去'], ['よみたい', 'yomitai', '想读'],
        ['あそびたい', 'asobitai', '想玩'], ['ねたい', 'netai', '想睡'],
        ['りょこう', 'ryokou', '旅行'], ['くつ', 'kutsu', '鞋'],
        ['パソコン', 'pasokon', '电脑'], ['スマートフォン', 'sumaato fon', '智能手机'],
        ['えいが', 'eiga', '电影'], ['おかね', 'okane', '钱']
      ],
      examples: [
        ['あたらしい くつが ほしいです。', 'atarashii kutsu ga hoshii desu', '我想要新鞋。', '我已经有新鞋。', '我想买新书。'],
        [['にほんへ', 'いきたいです'], 'nihon e ikitai desu', '我想去日本。']
      ],
      read: 'ねたい', note: '想要东西用名词＋が ほしい；想做动作则用动词ます形去ます加たい。'
    },
    '12': {
      words: [
        ['たかい', 'takai', '高的；贵的'], ['おそい', 'osoi', '慢的；晚的'],
        ['ちかい', 'chikai', '近的'], ['とおい', 'tooi', '远的'],
        ['おおい', 'ooi', '多的'], ['すくない', 'sukunai', '少的'],
        ['ながい', 'nagai', '长的'], ['みじかい', 'mijikai', '短的'],
        ['おおきい', 'ookii', '大的'], ['ちいさい', 'chiisai', '小的'],
        ['どちら', 'dochira', '哪一个；哪边'], ['ほう', 'hou', '一方；一边']
      ],
      examples: [
        ['この くつは あの くつより やすいです。', 'kono kutsu wa ano kutsu yori yasui desu', '这双鞋比那双鞋便宜。', '那双鞋比这双鞋便宜。', '这双鞋比那双鞋大。'],
        [['この', 'みせのほうが', 'ちかいです'], 'kono mise no hou ga chikai desu', '这家店更近。']
      ],
      read: 'とおい', note: 'より后面是比较基准；のほうが指出更具有某种特征的一方。'
    },
    '13': {
      words: [
        ['すわって', 'suwatte', '坐：すわります的て形'], ['たって', 'tatte', '站：たちます的て形'],
        ['つかって', 'tsukatte', '用：つかいます的て形'], ['あけて', 'akete', '开：あけます的て形'],
        ['しめて', 'shimete', '关：しめます的て形'], ['おいて', 'oite', '放：おきます的て形'],
        ['たべて', 'tabete', '吃：たべます的て形'], ['さわって', 'sawatte', '摸：さわります的て形'],
        ['およいで', 'oyoide', '游泳：およぎます的て形'], ['きんし', 'kinshi', '禁止'],
        ['だいじょうぶ', 'daijoubu', '没问题'], ['みせ', 'mise', '商店']
      ],
      examples: [
        ['ここで たべても いいですか。', 'koko de tabetemo ii desu ka', '可以在这里吃东西吗？', '这里禁止吃东西。', '可以在这里拍照吗？'],
        [['この', 'ドアを', 'あけては', 'いけません'], 'kono doa o akete wa ikemasen', '不可以打开这扇门。']
      ],
      read: 'きんし', note: 'て形＋も いいですか用于询问许可；て形＋は いけません表示禁止。'
    },
    '14': {
      words: [
        ['きょう', 'kyou', '今天'], ['あさって', 'asatte', '后天'],
        ['こんしゅう', 'konshuu', '这周'], ['しゅうまつ', 'shuumatsu', '周末'],
        ['こんど', 'kondo', '下次；改天'], ['あいましょう', 'aimashou', '见面吧'],
        ['のみましょう', 'nomimashou', '一起喝吧'], ['みましょう', 'mimashou', '一起看吧'],
        ['あそびましょう', 'asobimashou', '一起玩吧'], ['かえりましょう', 'kaerimashou', '一起回去吧'],
        ['ひま', 'hima', '有空'], ['やくそく', 'yakusoku', '约定']
      ],
      examples: [
        ['しゅうまつ、いっしょに えいがを みませんか。', 'shuumatsu issho ni eiga o mimasen ka', '周末一起看电影好吗？', '周末不要看电影。', '周末一起去买电影票吧。'],
        [['あさって', 'こうえんで', 'あいましょう'], 'asatte kouen de aimashou', '后天在公园见面吧。']
      ],
      read: 'しゅうまつ', note: 'ませんか是在发出邀请；ましょう是在提议或回应一起行动。'
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  root.CourseEnrichment = data;
})(typeof globalThis !== 'undefined' ? globalThis : window);
