(function (root) {
  'use strict';

  const data = root.KanaData || (typeof require === 'function' ? require('./kana-data.js') : {});
  const items = [...data.items, ...(data.mixedExamples || [])];
  const byId = new Map(items.map(item => [item.id, item]));
  const journeyOrder = (() => {
    const kana = items.filter(item => item.kind !== 'word');
    const words = items.filter(item => item.kind === 'word');
    const order = [];
    let nextWord = 0;
    kana.forEach((item, index) => {
      order.push(item);
      const due = Math.floor((index + 1) * words.length / kana.length);
      while (nextWord < due) order.push(words[nextWord++]);
    });
    while (nextWord < words.length) order.push(words[nextWord++]);
    return order;
  })();
  const VERSION = 1;
  const MODES = ['hiragana', 'katakana', 'mixed'];
  const GROUPS = ['base', 'voiced', 'yoon', 'special'];
  const FILTERS = ['all', 'unseen', 'learning', 'mastered', 'retired'];

  function newState() {
    return {
      version: VERSION,
      mode: 'hiragana',
      practicePool: 'all',
      audioSpeed: 'slow',
      group: 'base',
      filter: 'all',
      records: {},
      courseRecords: {},
      vocabRecords: {},
      questionCount: 0,
      journeyTurns: 0,
      journeyStreak: 0,
      recentQuestionIds: []
    };
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function targetMs(item) {
    return item.kind === 'word' ? (item.script === 'mixed' ? 16000 : 10000) : item.kind === 'yoon' ? 6000 : 4000;
  }
  function emptyRecord() {
    return { attemptCount: 0, attempts: [], correctTimes: [], lastQuestionIndex: -1 };
  }
  function recordFor(state, id) { return state.records[id] || emptyRecord(); }
  function getStatus(state, id) {
    const record = recordFor(state, id);
    if (record.manualMastered === true) return 'retired';
    if (record.manualLearned === false || (!record.attemptCount && record.manualLearned !== true)) return 'unseen';
    const lastEight = record.attempts.slice(-8);
    const good = lastEight.length === 8 && lastEight.filter(a => a.correct).length >= 7;
    const latestTwo = lastEight.length >= 2 && lastEight.slice(-2).every(a => a.correct);
    const fast = median(record.correctTimes) !== null && median(record.correctTimes) <= targetMs(byId.get(id));
    return good && latestTwo && fast ? 'mastered' : 'learning';
  }
  function getMetrics(state, id) {
    const item = byId.get(id);
    const record = recordFor(state, id);
    const active = getStatus(state, id) !== 'unseen';
    const attempts = active ? record.attempts : [];
    const count = attempts.length;
    const correct = attempts.filter(a => a.correct).length;
    const accuracy = (correct + 1) / (count + 2);
    const responseMs = active ? median(record.correctTimes) : null;
    const slow = responseMs === null ? 1 : clamp(responseMs / targetMs(item) - 1, 0, 1);
    const difficulty = 0.7 * (1 - accuracy) + 0.3 * slow;
    return { count, correct, accuracy, responseMs, targetMs: targetMs(item), slow, difficulty, weight: getStatus(state, id) === 'retired' ? 0 : 1 + 5 * difficulty };
  }

  function recordAnswer(state, id, correct, elapsedMs) {
    if (!byId.has(id)) throw new Error(`Unknown item: ${id}`);
    const old = recordFor(state, id);
    const duration = clamp(Number.isFinite(elapsedMs) ? Math.round(elapsedMs) : 60000, 0, 60000);
    const questionCount = state.questionCount + 1;
    const nextRecord = {
      attemptCount: old.attemptCount + 1,
      attempts: [...old.attempts, { correct: Boolean(correct), ms: duration }].slice(-10),
      correctTimes: correct ? [...old.correctTimes, duration].slice(-5) : [...old.correctTimes],
      lastQuestionIndex: questionCount,
      manualLearned: true,
      manualMastered: old.manualMastered === true
    };
    return {
      ...state,
      records: { ...state.records, [id]: nextRecord },
      questionCount,
      recentQuestionIds: [...state.recentQuestionIds, id].slice(-2)
    };
  }

  function setLearned(state, id, learned) {
    if (!byId.has(id)) throw new Error(`Unknown item: ${id}`);
    const old = recordFor(state, id);
    return {
      ...state,
      records: { ...state.records, [id]: { ...old, manualLearned: Boolean(learned), manualMastered: learned && old.manualMastered === true, lastQuestionIndex: learned ? old.lastQuestionIndex : -1 } }
    };
  }

  function setManualMastered(state, id, mastered) {
    if (!byId.has(id)) throw new Error(`Unknown item: ${id}`);
    const old = recordFor(state, id);
    return {
      ...state,
      records: { ...state.records, [id]: { ...old, manualLearned: true, manualMastered: Boolean(mastered) } }
    };
  }

  function eligibleItems(state, mode = state.mode, group = null, includeUnseen = false) {
    return items.filter(item =>
      (mode === 'mixed' || item.script === mode) &&
      (!group || item.group === group) &&
      getStatus(state, item.id) !== 'retired' &&
      (includeUnseen || getStatus(state, item.id) !== 'unseen')
    );
  }

  function chooseNext(state, mode = state.mode, rng = Math.random, group = null, includeUnseen = false) {
    const pool = eligibleItems(state, mode, group, includeUnseen);
    if (!pool.length) return null;
    const avoid = pool.length > 3 ? new Set(state.recentQuestionIds) : new Set();
    const candidates = pool.filter(item => !avoid.has(item.id));
    const active = candidates.length ? candidates : pool;
    const overdueAfter = Math.max(pool.length * 2, 40);
    const overdue = active.filter(item => state.questionCount - recordFor(state, item.id).lastQuestionIndex >= overdueAfter);
    if (overdue.length) {
      overdue.sort((a, b) => recordFor(state, a.id).lastQuestionIndex - recordFor(state, b.id).lastQuestionIndex);
      return overdue[0];
    }
    const total = active.reduce((sum, item) => sum + getMetrics(state, item.id).weight, 0);
    let point = clamp(Number(rng()) || 0, 0, 0.999999999) * total;
    for (const item of active) {
      point -= getMetrics(state, item.id).weight;
      if (point < 0) return item;
    }
    return active[active.length - 1];
  }

  function chooseJourneyNext(state, rng = Math.random) {
    const unseen = journeyOrder.find(item => getStatus(state, item.id) === 'unseen');
    const learned = eligibleItems(state, 'mixed');
    if (unseen && (learned.length < 6 || state.journeyTurns % 3 === 0)) return unseen;
    return chooseNext(state, 'mixed', rng, null, false) || unseen;
  }

  function normalizeRomaji(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
  }
  function isCorrect(item, answer) {
    const input = normalizeRomaji(answer);
    return Boolean(input) && (input === item.kana || item.aliases.some(alias => normalizeRomaji(alias) === input));
  }

  const mappings = { hiragana: new Map(), katakana: new Map() };
  for (const item of items.filter(item => item.group !== 'special')) {
    for (const alias of item.aliases) {
      // Common spellings are intentionally assigned to the usual glyph first.
      if (!mappings[item.script].has(alias)) mappings[item.script].set(alias, item.kana);
    }
  }
  const keys = Object.fromEntries(Object.entries(mappings).map(([script, map]) =>
    [script, [...map.keys()].sort((a, b) => b.length - a.length)]));

  function convertRomaji(value, script = 'hiragana', targetItem = null) {
    const input = normalizeRomaji(value);
    if (!['hiragana', 'katakana'].includes(script)) script = 'hiragana';
    if (targetItem && (targetItem.script === script || targetItem.script === 'mixed') && isCorrect(targetItem, input)) {
      return { text: targetItem.kana, candidates: ambiguityHints(input, script), complete: true };
    }
    let output = '';
    let index = 0;
    let lastVowel = '';
    let complete = true;
    while (index < input.length) {
      const current = input[index];
      const next = input[index + 1] || '';
      if (current === 'n') {
        if (next === "'") { output += script === 'hiragana' ? 'ん' : 'ン'; index += 2; lastVowel = ''; continue; }
        if (next === 'n') {
          output += script === 'hiragana' ? 'ん' : 'ン';
          index += /[aiueoy]/.test(input[index + 2] || '') ? 1 : 2;
          lastVowel = '';
          continue;
        }
        if (next && !/[aiueoy]/.test(next)) { output += script === 'hiragana' ? 'ん' : 'ン'; index++; lastVowel = ''; continue; }
        if (!next) { output += script === 'hiragana' ? 'ん' : 'ン'; index++; continue; }
      }
      if (current === next && /[bcdfghjklmpqrstvwxyz]/.test(current) && current !== 'n') {
        output += script === 'hiragana' ? 'っ' : 'ッ';
        index++;
        lastVowel = '';
        continue;
      }
      const key = keys[script].find(candidate => input.startsWith(candidate, index));
      if (key) {
        const kana = mappings[script].get(key);
        const vowel = key.match(/[aiueo]$/)?.[0] || '';
        if (script === 'katakana' && key.length === 1 && vowel && lastVowel === vowel && output) output += 'ー';
        else output += kana;
        lastVowel = vowel;
        index += key.length;
        continue;
      }
      const remainder = input.slice(index);
      if (keys[script].some(candidate => candidate.startsWith(remainder))) {
        output += remainder;
        complete = false;
        break;
      }
      output += current;
      complete = false;
      lastVowel = '';
      index++;
    }
    return { text: output, candidates: ambiguityHints(input, script), complete };
  }

  function ambiguityHints(input, script) {
    const pairs = script === 'hiragana'
      ? { ji: 'じ / ぢ', zu: 'ず / づ', ja: 'じゃ / ぢゃ', ju: 'じゅ / ぢゅ', jo: 'じょ / ぢょ' }
      : { ji: 'ジ / ヂ', zu: 'ズ / ヅ', ja: 'ジャ / ヂャ', ju: 'ジュ / ヂュ', jo: 'ジョ / ヂョ' };
    return Object.entries(pairs).filter(([key]) => input.includes(key)).map(([key, value]) => `${key} → ${value}`);
  }

  function sanitizeState(raw) {
    const clean = newState();
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return clean;
    clean.mode = MODES.includes(raw.mode) ? raw.mode : clean.mode;
    clean.practicePool = ['all', 'learned', 'journey'].includes(raw.practicePool) ? raw.practicePool : clean.practicePool;
    clean.audioSpeed = ['slow', 'normal'].includes(raw.audioSpeed) ? raw.audioSpeed : clean.audioSpeed;
    clean.group = GROUPS.includes(raw.group) ? raw.group : clean.group;
    clean.filter = FILTERS.includes(raw.filter) ? raw.filter : clean.filter;
    clean.questionCount = Number.isSafeInteger(raw.questionCount) ? clamp(raw.questionCount, 0, 1000000000) : 0;
    clean.journeyTurns = Number.isSafeInteger(raw.journeyTurns) ? clamp(raw.journeyTurns, 0, clean.questionCount) : 0;
    clean.journeyStreak = Number.isSafeInteger(raw.journeyStreak) ? clamp(raw.journeyStreak, 0, clean.journeyTurns) : 0;
    if (raw.records && typeof raw.records === 'object') {
      for (const [id, value] of Object.entries(raw.records)) {
        if (!byId.has(id) || !value || typeof value !== 'object') continue;
        const attempts = Array.isArray(value.attempts) ? value.attempts.slice(-10).filter(a => a && typeof a.correct === 'boolean' && Number.isFinite(a.ms)).map(a => ({ correct: a.correct, ms: clamp(Math.round(a.ms), 0, 60000) })) : [];
        const correctTimes = Array.isArray(value.correctTimes) ? value.correctTimes.slice(-5).filter(Number.isFinite).map(ms => clamp(Math.round(ms), 0, 60000)) : [];
        clean.records[id] = {
          attemptCount: Number.isSafeInteger(value.attemptCount) ? clamp(value.attemptCount, attempts.length, 1000000000) : attempts.length,
          attempts,
          correctTimes,
          lastQuestionIndex: Number.isSafeInteger(value.lastQuestionIndex) ? clamp(value.lastQuestionIndex, -1, clean.questionCount) : -1,
          ...(typeof value.manualLearned === 'boolean' ? { manualLearned: value.manualLearned } : {}),
          ...(typeof value.manualMastered === 'boolean' ? { manualMastered: value.manualMastered } : {})
        };
      }
    }
    clean.recentQuestionIds = Array.isArray(raw.recentQuestionIds) ? raw.recentQuestionIds.filter(id => byId.has(id)).slice(-2) : [];
    const courseCore = root.CourseCore || (typeof require === 'function' ? require('./course-core.js') : null);
    clean.courseRecords = courseCore ? courseCore.sanitizeRecords(raw.courseRecords) : {};
    const vocabCore = root.VocabCore || (typeof require === 'function' ? require('./vocab-core.js') : null);
    clean.vocabRecords = vocabCore ? vocabCore.sanitizeRecords(raw.vocabRecords) : {};
    return clean;
  }

  const api = { VERSION, items, byId, newState, sanitizeState, recordFor, getStatus, getMetrics, recordAnswer, setLearned, setManualMastered, eligibleItems, chooseNext, chooseJourneyNext, normalizeRomaji, isCorrect, convertRomaji, targetMs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KanaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
