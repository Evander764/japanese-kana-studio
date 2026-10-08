const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../course-data.js');
const core = require('../course-core.js');
const kanaCore = require('../core.js');

test('all eight beginner lessons have five distinct tasks and offline audio', () => {
  assert.equal(data.lessons.length, 8);
  assert.equal(new Set(data.lessons.map(lesson => lesson.id)).size, 8);
  for (const lesson of data.lessons) {
    assert.deepEqual(lesson.questions.map(question => question.type), ['meaning', 'particle', 'order', 'read', 'listen']);
    assert.equal(new Set(lesson.questions.map(question => question.id)).size, 5);
    assert.ok(lesson.grammar.length >= 2);
    assert.ok(lesson.vocabulary.length >= 4);
    assert.ok(lesson.questions.every(question => question.explain));
    for (const question of lesson.questions) {
      if (question.options) {
        assert.equal(new Set(question.options).size, question.options.length, question.id);
        assert.ok(question.options.includes(question.answer), question.id);
      }
      if (question.type === 'order') {
        const letters = question.answer.replace(/[\s　。]/g, '');
        const pieces = question.tiles.join('').replace(/[\s　。]/g, '');
        assert.deepEqual([...letters].sort(), [...pieces].sort(), question.id);
      }
    }
    for (const file of [lesson.example.audio, ...lesson.vocabulary.map(word => word.audio), lesson.questions[4].audio]) {
      assert.ok(fs.statSync(path.join(__dirname, '..', file)).size > 1000, file);
    }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', 'course-manifest.json'), 'utf8'));
  assert.equal(manifest.length, 56);
});

test('normalization accepts alternate romanization and ignores spacing in word order', () => {
  const lesson = data.lessons[0];
  assert.equal(core.isCorrect(lesson.questions[2], 'わたしは　がくせいです。'), true);
  assert.equal(core.isCorrect(lesson.questions[2], 'がくせい わたしは です'), false);
  assert.equal(core.isCorrect(data.lessons[7].questions[3], 'oisii'), true);
  assert.equal(core.isCorrect(data.lessons[7].questions[3], 'oishi'), false);
});

test('automatic mastery requires four correct including both production tasks and can regress', () => {
  let state = kanaCore.newState();
  const ids = data.lessons[0].questions.map(question => question.id);
  const good = ids.map((id, index) => ({ id, correct: index !== 0 }));
  state = core.recordRun(state, '01', good);
  assert.equal(core.getStatus(state, '01'), 'mastered');
  assert.deepEqual(core.weakQuestions(state, '01').map(question => question.id), [ids[0]]);
  state = core.recordRun(state, '01', [{ id: ids[0], correct: true }], true);
  assert.equal(core.getStatus(state, '01'), 'mastered');
  assert.deepEqual(core.weakQuestions(state, '01'), []);
  state = core.recordRun(state, '01', ids.map((id, index) => ({ id, correct: index !== 2 })));
  assert.equal(core.getStatus(state, '01'), 'learning');
});

test('manual confirmation removes an item and a lesson from automatic review, survives export and can be reversed', () => {
  let state = kanaCore.newState();
  const kana = kanaCore.items.find(item => item.kana === 'あ' && item.script === 'hiragana');
  state = kanaCore.setManualMastered(state, kana.id, true);
  state = core.setManualMastered(state, '01', true);
  assert.equal(kanaCore.getStatus(state, kana.id), 'retired');
  assert.equal(core.getStatus(state, '01'), 'retired');
  assert.ok(!kanaCore.eligibleItems(state, 'hiragana', null, true).some(item => item.id === kana.id));
  assert.equal(core.recommendedLesson(state).id, '02');
  const restored = kanaCore.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(kanaCore.getStatus(restored, kana.id), 'retired');
  assert.equal(core.getStatus(restored, '01'), 'retired');
  assert.equal(kanaCore.getStatus(kanaCore.setManualMastered(restored, kana.id, false), kana.id), 'learning');
  assert.equal(core.getStatus(core.setManualMastered(restored, '01', false), '01'), 'unseen');
});
