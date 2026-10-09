const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../course-data.js');
const core = require('../course-core.js');
const kanaCore = require('../core.js');

test('all fourteen beginner lessons have expanded content and matching offline audio', () => {
  assert.deepEqual(data.lessons.map(lesson => lesson.id), Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, '0')));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', 'course-manifest.json'), 'utf8'));
  const recordings = new Map(manifest.map(entry => [entry.file, entry]));
  const usedAudio = [];
  for (const lesson of data.lessons) {
    assert.deepEqual(lesson.questions.map(question => question.type), ['meaning', 'particle', 'order', 'read', 'listen', 'meaning', 'order', 'read']);
    assert.equal(new Set(lesson.questions.map(question => question.id)).size, 8);
    assert.ok(lesson.grammar.length >= 2);
    assert.ok(lesson.vocabulary.length >= 16);
    assert.equal(lesson.examples.length, 3);
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
    for (const item of [...lesson.examples, ...lesson.vocabulary, ...lesson.questions]) {
      const file = item.audio;
      assert.ok(fs.statSync(path.join(__dirname, '..', file)).size > 1000, file);
      const recording = recordings.get(path.basename(file));
      assert.equal(recording?.kana, item.spoken || item.kana, file + ' must match its spoken text');
      assert.ok(recording.seconds > 0.2 && recording.voice, file);
      assert.ok(recording.engine === 'kokoro-82m' ? recording.phonemes?.length : recording.synthesisText, file);
      usedAudio.push(path.basename(file));
    }
  }
  assert.equal(manifest.length, 392);
  assert.equal(recordings.size, usedAudio.length);
  assert.deepEqual([...recordings.keys()].sort(), usedAudio.sort());
  assert.equal(data.roadmap.length, 0);
});

test('normalization accepts alternate romanization and ignores spacing in word order', () => {
  const lesson = data.lessons[0];
  assert.equal(core.isCorrect(lesson.questions[2], 'わたしは　がくせいです。'), true);
  assert.equal(core.isCorrect(lesson.questions[2], 'がくせい わたしは です'), false);
  assert.equal(core.isCorrect(data.lessons[7].questions[3], 'oisii'), true);
  assert.equal(core.isCorrect(data.lessons[7].questions[3], 'oishi'), false);
  assert.equal(core.isCorrect(data.lessons[10].questions[3], 'ZITENSYA'), true);
  assert.equal(core.isCorrect(data.lessons[12].questions[3], 'syasin'), true);
  assert.equal(core.isCorrect(data.lessons[13].questions[3], 'issyoni'), true);
  assert.equal(core.isCorrect(data.lessons[13].questions[3], 'ishoni'), false);
  assert.equal(core.isCorrect(data.lessons[11].questions[2], 'バスより でんしゃのほうが はやいです。'), true);
  assert.equal(core.isCorrect(data.lessons[11].questions[2], 'バスのほうが でんしゃより はやいです。'), false);
  assert.equal(core.isCorrect(data.lessons[12].questions[2], 'しゃしんを ここで とっては いけません'), true);
  assert.equal(core.isCorrect(data.lessons[13].questions[2], 'あした えきへ いっしょに いきましょう'), true);
});

test('existing progress continues to lesson 09 and new lesson results survive import and regression', () => {
  let state = kanaCore.newState();
  for (const lesson of data.lessons.slice(0, 8)) state = core.setManualMastered(state, lesson.id, true);
  state = kanaCore.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(core.recommendedLesson(state).id, '09');
  for (const lesson of data.lessons.slice(8)) {
    state = core.recordRun(state, lesson.id, lesson.questions.map(question => ({ id: question.id, correct: true })));
    state = kanaCore.sanitizeState(JSON.parse(JSON.stringify(state)));
    assert.equal(core.getStatus(state, lesson.id), 'mastered', lesson.id);
  }
  assert.equal(core.getStatus(state, '01'), 'retired');
  const last = data.lessons.at(-1);
  state = core.recordRun(state, last.id, last.questions.map(question => ({ id: question.id, correct: question.type !== 'order' })));
  state = kanaCore.sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(core.getStatus(state, '14'), 'learning');
  assert.equal(core.recommendedLesson(state).id, '14');
  assert.deepEqual(core.weakQuestions(state, '14').map(question => question.type), ['order', 'order']);
});

test('automatic mastery requires seven correct including production tasks and can regress', () => {
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

test('saved five-question runs retain their results and mastery after content expansion', () => {
  const oldResults = data.lessons[0].questions.slice(0, 5).map(question => ({ id: question.id, correct: true }));
  const previous = { ...kanaCore.newState(), courseRecords: { '01': { runs: [{ at: 1, review: false, results: oldResults }], manualMastered: false } } };
  const restored = kanaCore.sanitizeState(previous);
  assert.equal(core.recordFor(restored, '01').runs[0].total, 5);
  assert.equal(core.getStatus(restored, '01'), 'mastered');
  assert.throws(() => core.recordRun(restored, '01', oldResults), /Incomplete course result/);
  const next = core.recordRun(restored, '01', data.lessons[0].questions.map(question => ({ id: question.id, correct: true })));
  assert.equal(core.recordFor(next, '01').runs.at(-1).total, 8);
  assert.equal(core.getStatus(next, '01'), 'mastered');
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
