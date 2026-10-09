const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vocab = require('../vocab-core.js');
const core = require('../core.js');

test('each sentence lesson has a vocabulary page with playable audio', () => {
  assert.deepEqual(vocab.chapters.map(chapter => chapter.id), Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, '0')));
  assert.equal(vocab.chapters.reduce((count, chapter) => count + chapter.words.length, 0), 238);
  assert.equal(vocab.byId.size, 221);
  assert.ok(vocab.chapters.every(chapter => chapter.words.length >= 16));
  const readings = new Map();
  for (const chapter of vocab.chapters) {
    for (const word of chapter.words) {
      assert.ok(word.kana && word.romaji && word.meaning);
      assert.ok(fs.statSync(path.join(__dirname, '..', word.audio)).size > 1000, word.audio);
      assert.equal(vocab.isCorrect({ type: 'read', word }, word.romaji), true, `${chapter.id} ${word.kana}`);
      const signature = `${word.romaji}|${word.meaning}`;
      if (readings.has(word.id)) assert.equal(signature, readings.get(word.id), `Repeated word changed meaning: ${word.id}`);
      readings.set(word.id, signature);
    }
  }
});

test('manual mastery skips a repeated word across chapters and survives progress import', () => {
  let state = core.newState();
  const book = vocab.byChapter.get('02').words.find(word => word.kana === 'ほん');
  state = vocab.recordAnswer(state, book.id, 'read', true);
  state = vocab.setManualMastered(state, book.id, true);
  assert.equal(vocab.getStatus(state, book.id), 'retired');
  assert.equal(vocab.eligibleWords(state, '02').some(word => word.id === book.id), false);
  assert.equal(vocab.eligibleWords(state, '05').some(word => word.id === book.id), false);
  assert.equal(vocab.buildDeck(state, '05', () => 0.5).some(question => question.word.id === book.id), false);
  const restored = core.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.vocabRecords[book.id], { attempts: [{ type: 'read', correct: true }], manualMastered: true });
  assert.equal(vocab.getStatus(restored, book.id), 'retired');
  state = vocab.setManualMastered(restored, book.id, false);
  assert.equal(vocab.getStatus(state, book.id), 'learning');
  assert.equal(vocab.eligibleWords(state, '05').some(word => word.id === book.id), true);
});

test('practice covers reading and meaning, accepts kana spelling variants, and rejects unrelated answers', () => {
  const state = core.newState();
  const deck = vocab.buildDeck(state, '14', () => 0.5);
  const words = vocab.byChapter.get('14').words;
  assert.equal(deck.length, words.length * 2);
  for (const word of words) {
    assert.deepEqual(deck.filter(question => question.word.id === word.id).map(question => question.type).sort(), ['meaning', 'read']);
  }
  const together = words.find(word => word.kana === 'いっしょに');
  assert.equal(vocab.isCorrect({ type: 'read', word: together }, 'issyo ni'), true);
  assert.equal(vocab.isCorrect({ type: 'read', word: together }, 'ishoni'), false);
  const question = deck.find(entry => entry.type === 'meaning');
  assert.equal(new Set(question.options).size, 3);
  assert.equal(vocab.isCorrect(question, question.word.meaning), true);
  assert.equal(vocab.isCorrect(question, '不相关的意思'), false);
  const oldState = core.sanitizeState({ ...core.newState(), vocabRecords: undefined });
  assert.deepEqual(oldState.vocabRecords, {});
  assert.deepEqual(core.newState().vocabRecords, {});
  let allMastered = state;
  for (const word of words) allMastered = vocab.setManualMastered(allMastered, word.id, true);
  assert.deepEqual(vocab.buildDeck(allMastered, '14'), []);
});
