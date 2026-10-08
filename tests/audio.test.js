const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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

test('every rebuilt audio file matches its recorded content hash and engine', () => {
  const names = ['manifest.json', 'phrase-manifest.json', 'course-manifest.json'];
  const entries = names.flatMap(name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', name), 'utf8')));
  assert.equal(entries.length, 527);
  assert.equal(new Set(entries.map(entry => entry.file)).size, 527);
  for (const entry of entries) {
    assert.ok(['kokoro-82m', 'qwen3-tts-voice-design', 'qwen3-tts-custom-voice', 'windows-sapi5'].includes(entry.engine), entry.file);
    assert.ok(entry.seconds > 0.2, entry.file);
    const file = fs.readFileSync(path.join(__dirname, '..', 'audio', entry.file));
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'), entry.sha256, entry.file);
  }
});
