(function () {
  'use strict';
  const core = window.KanaCore;
  const items = core.items;
  const $ = id => document.getElementById(id);
  const labels = { hiragana: '平假名', katakana: '片假名', mixed: '混合', base: '清音', voiced: '浊音·半浊音', yoon: '拗音', special: '促音·长音', unseen: '未学', learning: '学习中', mastered: '熟练' };
  const storageKey = 'kana-studio-progress-v1';
  let state = readStoredState();
  let view = 'learn';
  let convertScript = state.mode === 'mixed' ? 'hiragana' : state.mode;
  let detailItem = null;
  let selfTestActive = false;
  let selfTestAnswered = false;
  let selfTestStartedAt = 0;
  let selfTestPausedAt = 0;
  let selfTestPausedDuration = 0;
  let question = null;
  let previousItem = null;
  let activeAudio = null;
  let questionAnswered = false;
  let questionStartedAt = 0;
  let pausedAt = 0;
  let pausedDuration = 0;
  let practiceGroup = null;

  function readStoredState() {
    try { return core.sanitizeState(JSON.parse(localStorage.getItem(storageKey) || 'null')); }
    catch (_) { return core.newState(); }
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); $('storageMessage').textContent = ''; }
    catch (_) { $('storageMessage').textContent = '此浏览器无法保存本机进度；请使用“导出进度”备份。'; }
  }
  function modeItems() { return items.filter(item => state.mode === 'mixed' || item.script === state.mode); }
  function describe(item) { return `${item.group === 'special' ? item.row : labels[item.group]} · ${labels[item.script]}`; }
  function renderControls() {
    document.querySelectorAll('[data-mode]').forEach(button => { button.classList.toggle('active', button.dataset.mode === state.mode); button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)); });
    document.querySelectorAll('[data-group]').forEach(button => { button.classList.toggle('active', button.dataset.group === state.group); button.setAttribute('aria-pressed', String(button.dataset.group === state.group)); });
    document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'); });
    document.querySelectorAll('[data-convert-script]').forEach(button => { button.classList.toggle('active', button.dataset.convertScript === convertScript); button.setAttribute('aria-pressed', String(button.dataset.convertScript === convertScript)); });
    $('learnFilter').value = state.filter;
    $('practicePool').value = state.practicePool;
    $('practiceGroup').value = practiceGroup || 'all';
    for (const name of ['learn', 'practice', 'stats', 'convert']) $(`${name}View`).hidden = view !== name;
  }
  function renderOverview() {
    const list = modeItems();
    const started = list.filter(item => core.getStatus(state, item.id) !== 'unseen').length;
    const mastered = list.filter(item => core.getStatus(state, item.id) === 'mastered').length;
    $('countTotal').textContent = String(list.length);
    $('countStarted').textContent = String(started);
    $('countMastered').textContent = String(mastered);
    $('overviewMessage').textContent = started ? `已经开始 ${started} 项。打开进度页，可查看哪些音需要多练。` : '可直接开始自测，也可点字形学习或标记已学。';
  }
  function renderLearn() {
    const container = $('learnGrid');
    container.replaceChildren();
    const visible = modeItems().filter(item => item.group === state.group && (state.filter === 'all' || core.getStatus(state, item.id) === state.filter));
    const hasUnseen = modeItems().some(item => core.getStatus(state, item.id) === 'unseen');
    $('startUnseen').disabled = !hasUnseen;
    $('startUnseen').textContent = hasUnseen ? '学习下一个未学项目 →' : '全部已开始';
    $('learnEmpty').hidden = visible.length > 0;
    const rows = new Map();
    for (const item of visible) {
      const key = `${item.script}:${item.row}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(item);
    }
    for (const rowItems of rows.values()) {
      const row = document.createElement('div'); row.className = `kana-row ${rowItems[0].group === 'special' ? 'special' : ''}`;
      const heading = document.createElement('div'); heading.className = 'row-heading';
      const title = document.createElement('strong'); title.textContent = rowItems[0].row;
      const subtitle = document.createElement('span'); subtitle.textContent = `${labels[rowItems[0].script]} · ${rowItems.length} 项`;
      heading.append(title, subtitle);
      const cards = document.createElement('div'); cards.className = 'row-cards';
      for (const item of rowItems) {
        const status = core.getStatus(state, item.id);
        const card = document.createElement('div'); card.className = `kana-card ${item.kind === 'word' ? 'word' : ''}`;
        const open = document.createElement('button'); open.type = 'button'; open.className = 'card-open';
        open.dataset.openId = item.id; open.setAttribute('aria-label', `${item.kana}，${labels[status]}，打开学习卡片`);
        const glyph = document.createElement('span'); glyph.className = 'card-kana'; glyph.textContent = item.kana;
        const meta = document.createElement('span'); meta.className = 'card-meta';
        const statusText = document.createElement('span'); statusText.textContent = labels[status];
        const dot = document.createElement('span'); dot.className = `status-dot ${status}`; dot.setAttribute('aria-hidden', 'true');
        meta.append(statusText, dot); open.append(glyph, meta);
        const mark = document.createElement('button'); mark.type = 'button'; mark.className = 'card-mark';
        mark.dataset.markId = item.id;
        mark.setAttribute('aria-pressed', String(status !== 'unseen'));
        mark.setAttribute('aria-label', `${item.kana}：${status === 'unseen' ? '标记为学过' : '标记为未学'}`);
        mark.textContent = status === 'unseen' ? '＋ 标已学' : '↺ 标未学';
        card.append(open, mark); cards.append(card);
      }
      row.append(heading, cards); container.append(row);
    }
  }
  function renderStats() {
    const list = modeItems();
    const learned = list.filter(item => core.getStatus(state, item.id) !== 'unseen');
    const mastered = learned.filter(item => core.getStatus(state, item.id) === 'mastered');
    const summary = $('statsSummary'); summary.replaceChildren();
    for (const [value, label] of [[list.length, '当前专区总项目'], [learned.length, '已经开始'], [mastered.length, '达到熟练']]) {
      const box = document.createElement('div'); box.className = 'stat-box';
      const strong = document.createElement('strong'); strong.textContent = String(value);
      const span = document.createElement('span'); span.textContent = label;
      box.append(strong, span); summary.append(box);
    }
    const ranked = [...list].sort((a, b) => {
      const aStatus = core.getStatus(state, a.id), bStatus = core.getStatus(state, b.id);
      const rank = { learning: 0, mastered: 1, unseen: 2 };
      return rank[aStatus] - rank[bStatus] || core.getMetrics(state, b.id).difficulty - core.getMetrics(state, a.id).difficulty || a.id.localeCompare(b.id);
    });
    const body = $('statsBody'); body.replaceChildren();
    for (const item of ranked) {
      const status = core.getStatus(state, item.id);
      const metrics = core.getMetrics(state, item.id);
      const tr = document.createElement('tr');
      const cells = [item.kana, `${item.romaji} / ${item.group === 'special' ? item.row : labels[item.group]}`, labels[status], status === 'unseen' ? '—' : `${metrics.correct}/${metrics.count} · ${Math.round(metrics.correct / metrics.count * 100)}%`, metrics.responseMs === null ? '—' : `${(metrics.responseMs / 1000).toFixed(1)} 秒`, status === 'unseen' ? '—' : `${metrics.weight.toFixed(2)}×`];
      cells.forEach((value, index) => {
        const td = document.createElement('td');
        if (index === 2) { const tag = document.createElement('span'); tag.className = `status-tag ${status}`; tag.textContent = value; td.append(tag); }
        else td.textContent = value;
        tr.append(td);
      }); body.append(tr);
    }
  }
  function renderConvert() {
    const input = $('convertInput').value;
    const result = core.convertRomaji(input, convertScript);
    $('convertOutput').textContent = input.trim() ? result.text : 'ここに表示';
    $('convertCandidates').textContent = result.candidates.length ? `同音候选：${result.candidates.join('；')}` : '';
  }
  function renderAll() { renderControls(); renderOverview(); renderLearn(); renderStats(); renderConvert(); }
  function setView(next) {
    view = next;
    renderControls();
    if (next === 'practice') setQuestion();
    if (next === 'stats') renderStats();
    document.querySelector('.section-nav').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openDetail(id) {
    detailItem = core.byId.get(id);
    selfTestActive = false; selfTestAnswered = false;
    $('detailAudioMessage').textContent = '';
    $('detailTestAudioMessage').textContent = '';
    renderDetail();
    if (!$('detailDialog').open) $('detailDialog').showModal();
  }
  function renderDetail() {
    if (!detailItem) return;
    $('detailCategory').textContent = describe(detailItem);
    $('detailGlyph').textContent = detailItem.kana;
    $('detailGlyph').classList.toggle('word', detailItem.kind === 'word');
    $('detailTitle').textContent = detailItem.kana;
    $('detailRomaji').textContent = detailItem.romaji;
    $('detailMeaning').hidden = !detailItem.meaning;
    $('detailMeaning').textContent = detailItem.meaning ? `意思：${detailItem.meaning}` : '';
    $('detailRhythm').hidden = !detailItem.rhythm;
    $('detailRhythm').textContent = detailItem.rhythm ? `节拍：${detailItem.rhythm}` : '';
    $('detailAliases').textContent = detailItem.aliases.length > 1 ? `也接受：${detailItem.aliases.slice(1).join(' / ')}` : '';
    $('detailNote').textContent = detailItem.note || (detailItem.pair ? `另一种写法：${detailItem.pair}` : '');
    $('detailAnswer').hidden = selfTestActive && !selfTestAnswered;
    $('detailTest').hidden = !selfTestActive;
    $('detailStart').textContent = selfTestActive ? '再次自测' : '开始自测';
    $('detailNext').hidden = !modeItems().some(item => item.id !== detailItem.id && core.getStatus(state, item.id) === 'unseen');
  }
  function startSelfTest() {
    if (!detailItem) return;
    selfTestActive = true; selfTestAnswered = false;
    selfTestStartedAt = performance.now();
    selfTestPausedAt = document.hidden ? performance.now() : 0;
    selfTestPausedDuration = 0;
    $('detailInput').disabled = false;
    $('detailInput').value = '';
    $('detailPreview').textContent = '—';
    $('detailTestAudioMessage').textContent = '';
    $('detailFeedback').hidden = true;
    renderDetail(); $('detailInput').focus();
  }
  function submitSelfTest(event) {
    event.preventDefault();
    if (!detailItem || selfTestAnswered) return;
    const answer = $('detailInput').value;
    if (!answer.trim()) return;
    const correct = core.isCorrect(detailItem, answer);
    const pendingPause = selfTestPausedAt ? performance.now() - selfTestPausedAt : 0;
    const elapsed = performance.now() - selfTestStartedAt - selfTestPausedDuration - pendingPause;
    state = core.recordAnswer(state, detailItem.id, correct, elapsed);
    persist(); selfTestAnswered = true;
    $('detailInput').disabled = true;
    const feedback = $('detailFeedback'); feedback.hidden = false; feedback.classList.toggle('wrong', !correct);
    feedback.textContent = correct ? `答对了。${detailItem.kana} 读作 ${detailItem.romaji}。` : `这次没答对。${detailItem.kana} 读作 ${detailItem.romaji}；已加入练习题库。`;
    renderDetail(); renderOverview(); renderLearn(); renderStats();
    if (correct && nextUnseen(true, true)) return;
    $('detailStart').focus({ preventScroll: true });
  }
  function nextUnseen(fromCurrent = false, startTest = false) {
    const pool = modeItems().filter(item => item.group === state.group);
    let start = fromCurrent && detailItem ? pool.findIndex(item => item.id === detailItem.id) + 1 : 0;
    const ordered = [...pool.slice(start), ...pool.slice(0, start)];
    const available = item => (!fromCurrent || item.id !== detailItem?.id) && core.getStatus(state, item.id) === 'unseen';
    const next = ordered.find(available) || modeItems().find(available);
    if (next) { openDetail(next.id); if (startTest) startSelfTest(); return true; }
    else if (!fromCurrent) setView('learn');
    return false;
  }

  function setQuestion(showSuccess = false) {
    question = core.chooseNext(state, state.mode, Math.random, practiceGroup, state.practicePool === 'all');
    questionAnswered = false;
    $('practiceEmpty').hidden = Boolean(question);
    $('practiceContent').hidden = !question;
    if (!question) return;
    questionStartedAt = performance.now(); pausedAt = document.hidden ? performance.now() : 0; pausedDuration = 0;
    $('questionKind').textContent = describe(question);
    $('questionCounter').textContent = `第 ${state.questionCount + 1} 题`;
    $('questionGlyph').textContent = question.kana;
    $('questionGlyph').classList.toggle('word', question.kind === 'word');
    $('practiceInput').disabled = false;
    $('practiceInput').value = '';
    $('practicePreview').textContent = '—';
    const feedback = $('practiceFeedback');
    feedback.hidden = showSuccess !== true;
    feedback.classList.remove('wrong');
    if (showSuccess === true) feedback.textContent = '✓ 上一题答对，继续输入。';
    $('questionExplanation').hidden = true;
    $('showAnswer').hidden = false;
    $('questionAudio').hidden = false;
    $('nextQuestion').hidden = true;
    $('questionAudioMessage').textContent = '';
    renderPrevious();
    $('practiceInput').focus({ preventScroll: true });
  }
  function renderPrevious() {
    $('previousAnswer').hidden = !previousItem;
    $('previousAudioMessage').textContent = '';
    if (!previousItem) return;
    $('previousReading').textContent = `${previousItem.kana} · ${previousItem.romaji}`;
    $('previousMeaning').textContent = previousItem.meaning
      ? `${previousItem.meaning}｜${previousItem.rhythm}` : describe(previousItem);
  }
  function elapsedQuestionMs() {
    const pendingPause = pausedAt ? performance.now() - pausedAt : 0;
    return Math.max(0, performance.now() - questionStartedAt - pausedDuration - pendingPause);
  }
  function finishQuestion(correct, revealed = false) {
    if (!question || questionAnswered) return;
    state = core.recordAnswer(state, question.id, correct, elapsedQuestionMs());
    persist(); questionAnswered = true;
    $('practiceInput').disabled = true;
    const feedback = $('practiceFeedback'); feedback.hidden = false; feedback.classList.toggle('wrong', !correct);
    feedback.textContent = correct ? `答对了！${question.kana} 读作 ${question.romaji}。` : revealed ? `已记作一次未答对。${question.kana} 读作 ${question.romaji}。` : `再记住它：${question.kana} 读作 ${question.romaji}。`;
    $('questionExplanation').hidden = !question.meaning;
    $('questionExplanation').textContent = question.meaning ? `意思：${question.meaning}｜节拍：${question.rhythm}` : '';
    $('showAnswer').hidden = true; $('nextQuestion').hidden = false;
    previousItem = question;
    renderOverview(); renderLearn(); renderStats();
  }
  function submitQuestion(event) {
    event.preventDefault();
    if (!question || questionAnswered || !$('practiceInput').value.trim()) return;
    const correct = core.isCorrect(question, $('practiceInput').value);
    finishQuestion(correct);
    if (correct) setQuestion(true);
    else $('nextQuestion').focus({ preventScroll: true });
  }

  function speak(item, messageId) {
    const output = $(messageId);
    output.textContent = '';
    if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; activeAudio = null; }
    if (item.audio) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      const clip = new Audio(item.audio);
      activeAudio = clip;
      clip.onerror = () => { output.textContent = '词例音频无法打开，请检查 audio 文件夹。'; };
      clip.play().catch(() => { output.textContent = '浏览器阻止了播放，请再次点击朗读按钮。'; });
      return;
    }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      output.textContent = '此浏览器没有语音朗读功能。'; return;
    }
    const voices = window.speechSynthesis.getVoices();
    const japanese = voices.find(voice => /^ja(?:-|$)/i.test(voice.lang));
    if (!japanese) { output.textContent = '未检测到日语语音；请在系统中安装日语语音后重试。'; return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.kana);
    utterance.lang = 'ja-JP'; utterance.voice = japanese; utterance.rate = 0.82;
    utterance.onerror = () => { output.textContent = '朗读失败，请检查浏览器的语音设置。'; };
    window.speechSynthesis.speak(utterance);
  }

  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    previousItem = null;
    $('learnActionMessage').textContent = '';
    if ($('detailDialog').open) $('detailDialog').close();
    if (state.mode !== 'mixed') convertScript = state.mode;
    persist(); renderAll();
    if (view === 'practice') setQuestion();
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => { state.group = button.dataset.group; $('learnActionMessage').textContent = ''; persist(); renderControls(); renderLearn(); }));
  document.querySelectorAll('[data-convert-script]').forEach(button => button.addEventListener('click', () => { convertScript = button.dataset.convertScript; renderControls(); renderConvert(); }));
  $('learnFilter').addEventListener('change', event => { state.filter = event.target.value; $('learnActionMessage').textContent = ''; persist(); renderLearn(); });
  $('practicePool').addEventListener('change', event => { state.practicePool = event.target.value; previousItem = null; persist(); setQuestion(); });
  $('practiceGroup').addEventListener('change', event => { practiceGroup = event.target.value === 'all' ? null : event.target.value; previousItem = null; setQuestion(); });
  $('heroLearn').addEventListener('click', () => setView('learn'));
  $('heroPractice').addEventListener('click', () => { state.practicePool = 'all'; persist(); setView('practice'); });
  $('practiceToLearn').addEventListener('click', () => setView('learn'));
  $('startUnseen').addEventListener('click', () => nextUnseen());
  $('learnGrid').addEventListener('click', event => {
    const mark = event.target.closest('[data-mark-id]');
    if (mark) {
      const id = mark.dataset.markId;
      const item = core.byId.get(id);
      const learned = core.getStatus(state, id) === 'unseen';
      state = core.setLearned(state, id, learned);
      persist(); renderOverview(); renderLearn(); renderStats();
      $('learnActionMessage').textContent = `${item.kana} 已标记为${learned ? '学过' : '未学'}。${learned ? '现在可以进入已学练习。' : '已有答题记录会保留。'}`;
      return;
    }
    const open = event.target.closest('[data-open-id]');
    if (open) openDetail(open.dataset.openId);
  });
  $('closeDetail').addEventListener('click', () => $('detailDialog').close());
  $('detailDialog').addEventListener('click', event => { if (event.target === $('detailDialog')) $('detailDialog').close(); });
  $('detailStart').addEventListener('click', startSelfTest);
  $('detailNext').addEventListener('click', () => nextUnseen(true));
  $('detailForm').addEventListener('submit', submitSelfTest);
  $('detailInput').addEventListener('input', () => { $('detailPreview').textContent = core.convertRomaji($('detailInput').value, detailItem.script, detailItem).text || '—'; });
  $('detailAudio').addEventListener('click', () => speak(detailItem, 'detailAudioMessage'));
  $('detailTestAudio').addEventListener('click', () => {
    if (!detailItem || !selfTestActive) return;
    speak(detailItem, 'detailTestAudioMessage');
    if (!selfTestAnswered) $('detailInput').focus({ preventScroll: true });
  });
  $('practiceForm').addEventListener('submit', submitQuestion);
  $('practiceInput').addEventListener('input', () => { $('practicePreview').textContent = question ? core.convertRomaji($('practiceInput').value, question.script, question).text || '—' : '—'; });
  $('showAnswer').addEventListener('click', () => { finishQuestion(false, true); $('nextQuestion').focus({ preventScroll: true }); });
  $('questionAudio').addEventListener('click', () => {
    if (!question) return;
    speak(question, 'questionAudioMessage');
    (questionAnswered ? $('nextQuestion') : $('practiceInput')).focus({ preventScroll: true });
  });
  $('previousAudio').addEventListener('click', () => { if (previousItem) speak(previousItem, 'previousAudioMessage'); });
  document.addEventListener('keydown', event => {
    if (view === 'practice' && previousItem && event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      speak(previousItem, 'previousAudioMessage');
    }
  });
  $('nextQuestion').addEventListener('click', setQuestion);
  $('convertInput').addEventListener('input', renderConvert);
  document.addEventListener('visibilitychange', () => {
    if (question && !questionAnswered) {
      if (document.hidden && !pausedAt) pausedAt = performance.now();
      if (!document.hidden && pausedAt) { pausedDuration += performance.now() - pausedAt; pausedAt = 0; }
    }
    if (detailItem && $('detailDialog').open && selfTestActive && !selfTestAnswered) {
      if (document.hidden && !selfTestPausedAt) selfTestPausedAt = performance.now();
      if (!document.hidden && selfTestPausedAt) { selfTestPausedDuration += performance.now() - selfTestPausedAt; selfTestPausedAt = 0; }
    }
  });
  $('exportProgress').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `kana-progress-${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('storageMessage').textContent = '进度文件已导出。';
  });
  $('importProgress').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (raw.version !== core.VERSION || !raw.records || typeof raw.records !== 'object') throw new Error('格式或版本不匹配');
      if (!confirm('导入会覆盖这个浏览器当前的学习进度。确定导入吗？')) return;
      state = core.sanitizeState(raw); previousItem = null; persist(); renderAll(); if (view === 'practice') setQuestion();
      $('storageMessage').textContent = '进度已导入。';
    } catch (error) { $('storageMessage').textContent = `导入失败：${error.message}`; }
    finally { event.target.value = ''; }
  });
  $('resetProgress').addEventListener('click', () => {
    if (!confirm('确定清空所有学习记录吗？此操作不能撤销，建议先导出进度。')) return;
    const selectedMode = state.mode;
    state = core.newState(); state.mode = selectedMode;
    previousItem = null;
    persist(); renderAll(); if (view === 'practice') setQuestion();
    $('storageMessage').textContent = '学习记录已重置。';
  });

  renderAll();
})();
