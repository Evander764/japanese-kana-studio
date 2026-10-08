(function (root) {
  'use strict';

  const courseData = root.CourseData || (typeof require === 'function' ? require('./course-data.js') : {});
  const chapters = (courseData.lessons || []).map(lesson => ({
    id: lesson.id,
    title: lesson.title,
    words: lesson.vocabulary.map(word => ({ ...word, id: word.kana }))
  }));
  const byChapter = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const byId = new Map(chapters.flatMap(chapter => chapter.words.map(word => [word.id, word])));

  function recordFor(state, id) { return state.vocabRecords?.[id] || { attempts: [], manualMastered: false }; }
  function getStatus(state, id) {
    const record = recordFor(state, id);
    return record.manualMastered ? 'retired' : record.attempts.length ? 'learning' : 'unseen';
  }
  function eligibleWords(state, chapterId) {
    const chapter = byChapter.get(chapterId);
    if (!chapter) return [];
    return chapter.words.filter(word => getStatus(state, word.id) !== 'retired');
  }
  function setManualMastered(state, id, mastered) {
    if (!byId.has(id)) throw new Error('Unknown vocabulary word');
    return {
      ...state,
      vocabRecords: {
        ...state.vocabRecords,
        [id]: { ...recordFor(state, id), manualMastered: Boolean(mastered) }
      }
    };
  }
  function recordAnswer(state, id, type, correct) {
    if (!byId.has(id) || !['read', 'meaning'].includes(type) || typeof correct !== 'boolean') throw new Error('Invalid vocabulary answer');
    const old = recordFor(state, id);
    return {
      ...state,
      vocabRecords: {
        ...state.vocabRecords,
        [id]: { ...old, attempts: [...old.attempts, { type, correct }].slice(-10) }
      }
    };
  }
  function sanitizeRecords(raw) {
    const clean = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
    for (const [id, value] of Object.entries(raw)) {
      if (!byId.has(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const attempts = Array.isArray(value.attempts) ? value.attempts.slice(-10)
        .filter(entry => entry && ['read', 'meaning'].includes(entry.type) && typeof entry.correct === 'boolean')
        .map(entry => ({ type: entry.type, correct: entry.correct })) : [];
      if (attempts.length || value.manualMastered === true) {
        clean[id] = { attempts, manualMastered: value.manualMastered === true };
      }
    }
    return clean;
  }
  function normalizeRomaji(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[\s　'’\-]/g, '');
  }
  function isCorrect(question, response) {
    if (question.type === 'meaning') return question.word.meaning === response;
    if (question.type !== 'read') return false;
    const word = question.word;
    const input = normalizeRomaji(response);
    if (!input) return false;
    const kanaCore = root.KanaCore || (typeof require === 'function' ? require('./core.js') : null);
    const script = /[ァ-ヴー]/.test(word.kana) ? 'katakana' : 'hiragana';
    return normalizeRomaji(word.romaji) === input || kanaCore?.convertRomaji(input, script).text === word.kana;
  }
  function shuffle(list, rng) {
    const result = [...list];
    for (let index = result.length - 1; index > 0; index--) {
      const swap = Math.floor(rng() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }
  function buildDeck(state, chapterId, rng = Math.random) {
    const chapter = byChapter.get(chapterId);
    if (!chapter) return [];
    const meanings = [...new Set([...chapter.words, ...byId.values()].map(word => word.meaning))];
    return shuffle(eligibleWords(state, chapterId).flatMap(word => {
      const alternatives = shuffle(meanings.filter(meaning => meaning !== word.meaning), rng).slice(0, 2);
      return [
        { type: 'read', word },
        { type: 'meaning', word, options: shuffle([word.meaning, ...alternatives], rng) }
      ];
    }), rng);
  }

  const api = { chapters, byChapter, byId, recordFor, getStatus, eligibleWords, setManualMastered, recordAnswer, sanitizeRecords, isCorrect, buildDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VocabCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
