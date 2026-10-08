(function (root) {
  'use strict';

  const data = root.CourseData || (typeof require === 'function' ? require('./course-data.js') : {});
  const lessons = data.lessons || [];
  const byId = new Map(lessons.map(entry => [entry.id, entry]));

  function emptyRecord() { return { runs: [], manualMastered: false }; }
  function recordFor(state, lessonId) { return state.courseRecords?.[lessonId] || emptyRecord(); }
  function lastFullRun(record) { return [...record.runs].reverse().find(run => !run.review) || null; }
  function getStatus(state, lessonId) {
    const record = recordFor(state, lessonId);
    if (record.manualMastered) return 'retired';
    const run = lastFullRun(record);
    if (!run) return 'unseen';
    return run.score >= Math.ceil(run.total * 0.8) && run.productionCorrect ? 'mastered' : 'learning';
  }
  function normalizeJapanese(value) {
    return String(value || '').normalize('NFKC').replace(/[\s　。！？、,.]/g, '');
  }
  function normalizeRomaji(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[\s　'’\-]/g, '');
  }
  function isCorrect(question, response) {
    if (question.type === 'read') return question.answers.some(answer => normalizeRomaji(answer) === normalizeRomaji(response));
    if (question.type === 'order') return [question.answer, ...(question.acceptedAnswers || [])]
      .some(answer => normalizeJapanese(answer) === normalizeJapanese(response));
    return question.answer === response;
  }
  function makeRun(lesson, results, review, timestamp, allowLegacy = false) {
    if (!Array.isArray(results)) throw new Error('Course results must be an array');
    const known = new Set(lesson.questions.map(question => question.id));
    const seen = new Set();
    const clean = results.map(result => {
      if (!result || !known.has(result.id) || seen.has(result.id) || typeof result.correct !== 'boolean') {
        throw new Error('Invalid course result');
      }
      seen.add(result.id);
      return { id: result.id, correct: result.correct };
    });
    const legacyFullRun = allowLegacy && clean.length === 5 && lesson.questions.slice(0, 5).every(question => seen.has(question.id));
    if (!clean.length || (!review && clean.length !== lesson.questions.length && !legacyFullRun)) throw new Error('Incomplete course result');
    const production = lesson.questions.filter(question => seen.has(question.id) && (question.type === 'order' || question.type === 'read'));
    const productionCorrect = production.every(question => clean.some(result => result.id === question.id && result.correct));
    return {
      at: Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : 0,
      review: Boolean(review),
      results: clean,
      score: clean.filter(result => result.correct).length,
      total: clean.length,
      productionCorrect
    };
  }
  function recordRun(state, lessonId, results, review = false, timestamp = Date.now()) {
    const lesson = byId.get(lessonId);
    if (!lesson) throw new Error('Unknown lesson');
    const run = makeRun(lesson, results, review, timestamp);
    const old = recordFor(state, lessonId);
    return {
      ...state,
      courseRecords: {
        ...state.courseRecords,
        [lessonId]: { ...old, runs: [...old.runs, run].slice(-8) }
      }
    };
  }
  function setManualMastered(state, lessonId, mastered) {
    if (!byId.has(lessonId)) throw new Error('Unknown lesson');
    const old = recordFor(state, lessonId);
    return {
      ...state,
      courseRecords: {
        ...state.courseRecords,
        [lessonId]: { ...old, manualMastered: Boolean(mastered) }
      }
    };
  }
  function weakQuestions(state, lessonId) {
    const lesson = byId.get(lessonId);
    if (!lesson) return [];
    const runs = recordFor(state, lessonId).runs;
    const lastIndex = runs.findLastIndex(run => !run.review);
    if (lastIndex < 0) return [];
    const weak = new Set(runs[lastIndex].results.filter(result => !result.correct).map(result => result.id));
    for (const run of runs.slice(lastIndex + 1)) {
      for (const result of run.results) {
        if (result.correct) weak.delete(result.id);
        else weak.add(result.id);
      }
    }
    return lesson.questions.filter(question => weak.has(question.id));
  }
  function recommendedLesson(state) {
    return lessons.find(lesson => getStatus(state, lesson.id) === 'unseen')
      || lessons.find(lesson => getStatus(state, lesson.id) === 'learning')
      || lessons.find(lesson => getStatus(state, lesson.id) === 'mastered')
      || null;
  }
  function sanitizeRecords(raw) {
    const clean = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
    for (const [lessonId, lesson] of byId) {
      const value = raw[lessonId];
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const runs = [];
      if (Array.isArray(value.runs)) {
        for (const candidate of value.runs.slice(-8)) {
          try {
            runs.push(makeRun(lesson, candidate.results, candidate.review === true, candidate.at, true));
          } catch (_) { /* Ignore malformed imported attempts. */ }
        }
      }
      if (runs.length || value.manualMastered === true) {
        clean[lessonId] = { runs, manualMastered: value.manualMastered === true };
      }
    }
    return clean;
  }

  const api = { lessons, byId, recordFor, getStatus, normalizeJapanese, normalizeRomaji, isCorrect, recordRun, setManualMastered, weakQuestions, recommendedLesson, sanitizeRecords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CourseCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
