const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../kana-data.js');

test('every kana and word has a packaged local MP3', () => {
  const references = new Set(data.items.map(item => item.audio));
  assert.equal(references.size, 126);
  for (const reference of references) {
    assert.match(reference, /^audio\/[a-z-]+\.mp3$/);
    const file = path.join(__dirname, '..', reference);
    const buffer = fs.readFileSync(file);
    assert.ok(buffer.length > 1500, `${reference} is too small`);
    assert.ok(buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0), `${reference} is not MP3`);
  }
});

test('the synthesis manifest covers the 126 unique readings', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', 'manifest.json'), 'utf8'));
  assert.equal(manifest.length, 126);
  assert.equal(new Set(manifest.map(entry => entry.file)).size, 126);
  assert.equal(manifest.find(entry => entry.kana === 'は').phonemes, 'ha');
  assert.equal(manifest.find(entry => entry.kana === 'へ').phonemes, 'he');
  assert.equal(manifest.find(entry => entry.kana === 'にゅ').phonemes, 'ɲɨ');
  assert.ok(manifest.every(entry => entry.seconds > 0.2));
});
