const test = require('node:test');
const assert = require('node:assert/strict');
const pitch = require('../pitch-core.js');
const vocab = require('../vocab-core.js');

test('every course word has a valid pitch accent and an explicit source', () => {
  assert.equal(Object.keys(pitch.data).length, vocab.byId.size);
  for (const word of vocab.byId.values()) {
    const entry = pitch.lookup(word.kana);
    assert.ok(entry, word.kana);
    assert.ok(['irodori', 'ojad', 'openjtalk'].includes(entry.source), word.kana);
    assert.ok(entry.accents.length > 0, word.kana);
    for (const accent of entry.accents) assert.equal(pitch.pattern(word.kana, accent).length, pitch.splitMoras(word.kana).length, word.kana);
  }
});

test('mora splitting and Tokyo pitch contours mark the actual drop', () => {
  assert.deepEqual(pitch.splitMoras('ちゅうごく'), ['ちゅ', 'う', 'ご', 'く']);
  assert.deepEqual(pitch.splitMoras('きっぷ'), ['き', 'っ', 'ぷ']);
  assert.deepEqual(pitch.splitMoras('ノート'), ['ノ', 'ー', 'ト']);
  assert.deepEqual(pitch.pattern('かさ', 1).map(item => [item.level, item.dropAfter]), [['high', true], ['low', false]]);
  assert.deepEqual(pitch.pattern('がくせい', 0).map(item => item.level), ['low', 'high', 'high', 'high']);
  assert.deepEqual(pitch.pattern('にほん', 2).map(item => [item.level, item.dropAfter]), [['low', false], ['high', true], ['low', false]]);
  assert.deepEqual(pitch.pattern('くつ', 2).map(item => [item.level, item.dropAfter]), [['low', false], ['high', true]]);
});
