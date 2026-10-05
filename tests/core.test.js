const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../kana-data.js');
const core = require('../core.js');

function item(script, kana) { return data.items.find(entry => entry.script === script && entry.kana === kana); }

test('the complete kana chart has 46 basic, 25 voiced and 36 contracted entries per script', () => {
  assert.equal(new Set(data.items.map(entry => entry.id)).size, data.items.length);
  for (const script of data.scripts) {
    assert.equal(data.items.filter(entry => entry.script === script && entry.group === 'base').length, 46);
    assert.equal(data.items.filter(entry => entry.script === script && entry.group === 'voiced').length, 25);
    assert.equal(data.items.filter(entry => entry.script === script && entry.group === 'yoon').length, 36);
  }
  assert.equal(data.items.filter(entry => entry.group === 'special').length, 19);
  for (const entry of data.items.filter(entry => entry.group === 'special')) {
    assert.ok(entry.meaning, `${entry.kana} needs a meaning`);
    assert.ok(entry.rhythm, `${entry.kana} needs a rhythm hint`);
  }
});

test('common romanization variants and ambiguous readings are accepted for the displayed glyph', () => {
  for (const [kana, inputs] of [['し', ['shi', 'si']], ['ち', ['chi', 'ti']], ['つ', ['tsu', 'tu']], ['ふ', ['fu', 'hu']], ['ぢ', ['di', 'ji']], ['づ', ['du', 'zu']], ['ちゃ', ['cha', 'tya']], ['ぢゃ', ['dya', 'ja']]]) {
    for (const input of inputs) assert.equal(core.isCorrect(item('hiragana', kana), input), true, `${kana} ← ${input}`);
  }
  assert.equal(core.isCorrect(item('hiragana', 'し'), 'chi'), false);
  assert.equal(core.convertRomaji('ji', 'hiragana').text, 'じ');
  assert.match(core.convertRomaji('ji', 'hiragana').candidates.join(' '), /ぢ/);
  assert.equal(core.convertRomaji('ji', 'hiragana', item('hiragana', 'ぢ')).text, 'ぢ');
  assert.equal(item('hiragana', 'を').romaji, 'o');
  assert.equal(item('hiragana', 'ぢ').romaji, 'ji');
  assert.equal(item('hiragana', 'ぢゃ').romaji, 'ja');
  assert.equal(core.convertRomaji('wo', 'hiragana').text, 'を');
  assert.equal(core.convertRomaji('di', 'hiragana').text, 'ぢ');
});

test('conversion handles nasals, gemination, contracted sounds and long vowels', () => {
  assert.equal(core.convertRomaji('konnichiha', 'hiragana').text, 'こんにちは');
  assert.equal(core.convertRomaji('kippu', 'hiragana').text, 'きっぷ');
  assert.equal(core.convertRomaji('sha', 'hiragana').text, 'しゃ');
  assert.equal(core.convertRomaji('gakki', 'hiragana').text, 'がっき');
  assert.equal(core.convertRomaji('obaasan', 'hiragana').text, 'おばあさん');
  assert.equal(core.convertRomaji('kaaten', 'katakana').text, 'カーテン');
  assert.equal(core.convertRomaji('juusu', 'katakana').text, 'ジュース');
  assert.equal(core.convertRomaji('sui', 'katakana').text, 'スイ');
  assert.equal(core.convertRomaji('sh', 'hiragana').complete, false);
  for (const entry of data.items) {
    const spelling = entry.group === 'special' ? entry.romaji : entry.key;
    assert.equal(core.convertRomaji(spelling, entry.script).text, entry.kana, `${entry.kana} ← ${spelling}`);
  }
});

test('a first self-test adds only its own script to the practice pool', () => {
  const hira = item('hiragana', 'あ');
  const kata = item('katakana', 'ア');
  let state = core.newState();
  assert.equal(core.chooseNext(state), null);
  state = core.recordAnswer(state, hira.id, true, 2000);
  assert.equal(core.getStatus(state, hira.id), 'learning');
  assert.equal(core.getStatus(state, kata.id), 'unseen');
  assert.equal(core.chooseNext(state, 'hiragana').id, hira.id);
  assert.equal(core.chooseNext(state, 'katakana'), null);
});

test('direct self-test can draw unseen items and answers mark them learned', () => {
  let state = core.newState();
  const first = core.chooseNext(state, 'hiragana', () => 0, 'base', true);
  assert.ok(first);
  assert.equal(core.getStatus(state, first.id), 'unseen');
  state = core.recordAnswer(state, first.id, false, 9000);
  assert.equal(core.getStatus(state, first.id), 'learning');
  assert.ok(core.eligibleItems(state, 'hiragana', 'base').some(entry => entry.id === first.id));
});

test('manual learned flags change practice eligibility without erasing earlier answers', () => {
  const entry = item('katakana', 'カ');
  let state = core.newState();
  state = core.setLearned(state, entry.id, true);
  assert.equal(core.getStatus(state, entry.id), 'learning');
  assert.equal(core.chooseNext(state, 'katakana').id, entry.id);
  state = core.recordAnswer(state, entry.id, true, 1800);
  state = core.setLearned(state, entry.id, false);
  assert.equal(core.getStatus(state, entry.id), 'unseen');
  assert.equal(core.chooseNext(state, 'katakana'), null);
  assert.equal(core.recordFor(state, entry.id).attemptCount, 1);
  assert.equal(core.getMetrics(state, entry.id).weight, 4.25);
  state = core.setLearned(state, entry.id, true);
  assert.equal(core.recordFor(state, entry.id).attemptCount, 1);
  assert.equal(core.getStatus(state, entry.id), 'learning');
});

test('accuracy and speed change selection weight and mastery can regress', () => {
  const quick = item('hiragana', 'あ');
  const weak = item('hiragana', 'い');
  let state = core.newState();
  for (let n = 0; n < 8; n++) state = core.recordAnswer(state, quick.id, true, 1800);
  for (let n = 0; n < 8; n++) state = core.recordAnswer(state, weak.id, n < 3, 9000);
  assert.equal(core.getStatus(state, quick.id), 'mastered');
  assert.equal(core.getStatus(state, weak.id), 'learning');
  assert.ok(core.getMetrics(state, weak.id).weight > core.getMetrics(state, quick.id).weight);
  assert.ok(core.getMetrics(state, quick.id).weight >= 1);
  state = core.recordAnswer(state, quick.id, false, 9000);
  assert.equal(core.getStatus(state, quick.id), 'learning');
});

test('slow correct answers alone increase priority and only recent attempts are retained', () => {
  const fast = item('katakana', 'ア');
  const slow = item('katakana', 'イ');
  let state = core.newState();
  for (let n = 0; n < 12; n++) {
    state = core.recordAnswer(state, fast.id, true, 1200);
    state = core.recordAnswer(state, slow.id, true, 9000);
  }
  assert.equal(core.recordFor(state, fast.id).attempts.length, 10);
  assert.equal(core.recordFor(state, slow.id).correctTimes.length, 5);
  assert.ok(core.getMetrics(state, slow.id).weight > core.getMetrics(state, fast.id).weight);
  assert.equal(core.getStatus(state, slow.id), 'learning');
});

test('recent questions are suppressed and overdue questions are recovered', () => {
  let state = core.newState();
  const sample = ['あ', 'い', 'う', 'え'].map(kana => item('hiragana', kana));
  for (const entry of sample) state = core.recordAnswer(state, entry.id, true, 2000);
  const choice = core.chooseNext(state, 'hiragana', () => 0);
  assert.ok(!state.recentQuestionIds.includes(choice.id));
  for (let n = 0; n < 42; n++) state = core.recordAnswer(state, sample[3].id, true, 2000);
  assert.equal(core.chooseNext(state, 'hiragana', () => 0.99).id, sample[0].id);
});

test('infinite mixed learning introduces both scripts, then interleaves adaptive review', () => {
  let state = core.newState();
  state.mode = 'mixed'; state.practicePool = 'journey';
  const first = [];
  for (let turn = 0; turn < 6; turn++) {
    const next = core.chooseJourneyNext(state, () => 0);
    first.push(next.kana);
    state = core.recordAnswer(state, next.id, true, 1000);
    state.journeyTurns++;
  }
  assert.deepEqual(first, ['あ', 'ア', 'い', 'イ', 'う', 'ウ']);
  const seventh = core.chooseJourneyNext(state, () => 0);
  assert.equal(seventh.kana, 'え');
  state = core.recordAnswer(state, seventh.id, true, 1000);
  state.journeyTurns++;
  const review = core.chooseJourneyNext(state, () => 0);
  assert.equal(core.getStatus(state, review.id), 'learning');
  state = core.recordAnswer(state, review.id, true, 1000);
  state.journeyTurns++;
  state = core.recordAnswer(state, core.chooseJourneyNext(state, () => 0).id, true, 1000);
  state.journeyTurns++;
  assert.equal(core.chooseJourneyNext(state, () => 0).kana, 'エ');

  for (const entry of core.items) state = core.setLearned(state, entry.id, true);
  assert.ok(core.chooseJourneyNext(state, () => 0));
  assert.notEqual(core.getStatus(state, core.chooseJourneyNext(state, () => 0).id), 'unseen');
});

test('saved progress is sanitized without losing valid independent records', () => {
  const hira = item('hiragana', 'あ');
  const kata = item('katakana', 'ア');
  let state = core.recordAnswer(core.newState(), hira.id, true, 1200);
  state = core.recordAnswer(state, kata.id, false, 8000);
  const restored = core.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.records[hira.id].attemptCount, 1);
  assert.equal(restored.records[kata.id].attempts[0].correct, false);
  assert.equal(core.sanitizeState({ version: 999 }).questionCount, 0);
  state = core.setLearned(state, hira.id, false);
  state.practicePool = 'learned';
  const restoredManual = core.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restoredManual.practicePool, 'learned');
  assert.equal(core.getStatus(restoredManual, hira.id), 'unseen');
  state.mode = 'mixed'; state.practicePool = 'journey';
  state.journeyTurns = 2; state.journeyStreak = 1;
  const journeyRestored = core.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(journeyRestored.practicePool, 'journey');
  assert.equal(journeyRestored.journeyTurns, 2);
  assert.equal(journeyRestored.journeyStreak, 1);
  assert.equal(core.sanitizeState({ version: core.VERSION, records: {} }).journeyTurns, 0);
});
