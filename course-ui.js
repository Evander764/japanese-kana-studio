(function (root) {
  'use strict';
  const course = root.CourseCore;
  const roadmap = root.CourseData.roadmap;
  const foundationId = '00';
  const statusLabels = { unseen: '未开始', learning: '学习中', mastered: '自动学会', retired: '确认学会' };
  const typeLabels = { meaning: '看句选义', particle: '补全句子', order: '词块排序', read: '输入读音', listen: '听音选义' };
  const $ = id => document.getElementById(id);
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function create({ getState, onStateChange, onFoundationNavigate, onVocabNavigate, onLessonNavigate, speak }) {
    const foundationStarted = state => root.KanaCore.items.filter(item => item.group === 'base' && root.KanaCore.getStatus(state, item.id) !== 'unseen').length;
    const foundationComplete = state => state.foundationCompleted || foundationStarted(state) === 92;
    const initialSelection = () => Object.keys(getState().courseRecords || {}).length
      ? course.recommendedLesson(getState())?.id || course.lessons[course.lessons.length - 1].id
      : foundationComplete(getState()) ? course.lessons[0].id : foundationId;
    let selectedId = initialSelection();
    let session = null;
    let finished = null;

    function selected() { return course.byId.get(selectedId); }
    function select(id) {
      if (id !== foundationId && !course.byId.has(id)) return;
      selectedId = id; session = null; finished = null; render();
    }
    function update(nextState) { onStateChange(nextState); render(); }
    function render() {
      const state = getState();
      const counts = { unseen: 0, learning: 0, mastered: 0, retired: 0 };
      course.lessons.forEach(lesson => counts[course.getStatus(state, lesson.id)]++);
      const recommended = course.recommendedLesson(state);
      const hasCourseProgress = Object.keys(state.courseRecords || {}).length > 0;
      const startId = !hasCourseProgress && !foundationComplete(state) ? '00' : recommended?.id;
      $('courseOverview').innerHTML = `<div><strong>00–14</strong><span>学习路线</span></div><div><strong>${counts.mastered}</strong><span>句型课自动学会</span></div><div><strong>${counts.retired}</strong><span>句型课确认学会</span></div><p>${startId ? `<button type="button" class="course-recommend" data-course-recommend="${startId}">继续第 ${startId} 课 →</button>` : '所有句型课都已手动确认掌握。'}<span>随时选课，无需解锁。</span></p>`;
      const started = foundationStarted(state);
      const complete = foundationComplete(state);
      $('courseList').innerHTML = `<button type="button" class="course-list-item course-list-foundation ${selectedId === foundationId ? 'active' : ''}" data-course-select="00" aria-current="${selectedId === foundationId ? 'true' : 'false'}"><span class="course-list-number">00</span><span class="course-list-copy"><strong>五十音入门</strong><small>平假名 · 片假名 · 识读</small></span><span class="course-badge ${complete ? 'retired' : started ? 'learning' : ''}">${complete ? '已完成' : started ? '学习中' : '未开始'}</span></button>` + course.lessons.map(lesson => {
        const status = course.getStatus(state, lesson.id);
        return `<button type="button" class="course-list-item ${lesson.id === selectedId ? 'active' : ''}" data-course-select="${lesson.id}" aria-current="${lesson.id === selectedId ? 'true' : 'false'}"><span class="course-list-number">${lesson.id}</span><span class="course-list-copy"><strong>${html(lesson.title)}</strong><small>${html(lesson.goal)}</small></span><span class="course-badge ${status}">${statusLabels[status]}</span></button>`;
      }).join('');
      $('courseRoadmap').innerHTML = roadmap.map(entry => `<div><span>${entry.number}</span><strong>${html(entry.title)}</strong><p>${html(entry.goal)}</p></div>`).join('');
      $('courseRoadmap').closest('section').hidden = roadmap.length === 0;
      if (selectedId === foundationId) renderFoundation(started, complete);
      else if (session) renderQuestion();
      else if (finished && finished.lessonId === selectedId) renderFinished();
      else renderIntro();
    }

    function renderFoundation(started, complete) {
      $('coursePanel').innerHTML = `<div class="course-panel-head"><p class="section-kicker">LESSON 00 / 日语的声音与文字</p><h3>五十音，从这里开始。</h3><p>先认识平假名与片假名的字形和读音，再用识读练习巩固。准备好了，就进入第 01 课学习完整句子。</p><span class="course-badge ${complete ? 'retired' : started ? 'learning' : ''}">${complete ? '第 00 课已完成' : started ? `清音已开始 ${started} / 92 个字形` : '零基础起点'}</span></div>
        <div class="foundation-sample"><strong lang="ja">あ <span>ア</span></strong><p>同一个读音，两种写法。点开字卡可听发音，也可以直接自测。</p></div>
        <ol class="foundation-steps"><li><span>01</span><div><strong>先认识平假名</strong><p>从清音开始，按行看字形、听读音。</p></div><button type="button" class="outline-button" data-course-foundation="hiragana">开始学习 →</button></li><li><span>02</span><div><strong>再认识片假名</strong><p>对照另一套字形，继续看卡片、听发音。</p></div><button type="button" class="outline-button" data-course-foundation="katakana">开始学习 →</button></li><li><span>03</span><div><strong>用练习记牢读音</strong><p>看假名输入罗马字；之后可继续学浊音和拗音。</p></div><button type="button" class="outline-button" data-course-foundation="practice">开始练习 →</button></li></ol>
        <div class="course-actions"><button type="button" class="primary-button" data-course-foundation-complete="true">${complete ? '继续第 01 课' : '学完了，继续第 01 课'} →</button>${getState().foundationCompleted && started < 92 ? '<button type="button" class="text-button" data-course-foundation-complete="false">重新标记为学习中</button>' : ''}</div>`;
    }

    function renderIntro() {
      const lesson = selected();
      const state = getState();
      const status = course.getStatus(state, lesson.id);
      const weak = course.weakQuestions(state, lesson.id);
      const vocabMastered = lesson.vocabulary.filter(word => root.VocabCore.getStatus(state, word.kana) === 'retired').length;
      $('coursePanel').innerHTML = `<div class="course-panel-head"><p class="section-kicker">LESSON ${lesson.id} / ${html(lesson.chapter)}</p><h3>${html(lesson.title)}</h3><p>${html(lesson.goal)}</p><span class="course-badge ${status}">${statusLabels[status]}</span></div>
        <div class="course-example-list">${lesson.examples.map((entry, index) => `<div class="course-example"><div><small>例句 ${index + 1} · 先读一遍，再听发音</small><strong lang="ja">${html(entry.kana)}</strong><span data-romaji>${html(entry.romaji)}</span><span>${html(entry.meaning)}</span></div><button type="button" class="outline-button" data-course-audio="example${index}">▶ 听整句</button></div>`).join('')}</div>
        <p id="courseAudioMessage" class="audio-message" role="status"></p>
        <div class="course-grammar"><h4>这节要会什么</h4>${lesson.grammar.map(entry => `<div><strong lang="ja">${html(entry.pattern)}</strong><p>${html(entry.detail)}</p></div>`).join('')}</div>
        <div class="course-vocab"><h4>本课单词 ${lesson.vocabulary.length} 个 · 已学会 ${vocabMastered} 个</h4><div>${lesson.vocabulary.map((entry, index) => `<button type="button" data-course-audio="v${index}" aria-label="播放 ${html(entry.kana)} 的合成读音"><strong lang="ja">${html(entry.kana)}</strong><span>${html(entry.meaning)}</span><small data-romaji>${html(entry.romaji)}</small></button>`).join('')}</div></div>
        <div class="course-actions"><button type="button" class="primary-button" data-course-start="full">${status === 'unseen' ? '开始八题挑战' : '重新练习八题'} →</button><button type="button" class="outline-button" data-course-vocab>打开本课单词本</button>${weak.length && status !== 'retired' ? `<button type="button" class="outline-button" data-course-start="review">只练 ${weak.length} 道错题</button>` : ''}<button type="button" class="text-button" data-course-master>${status === 'retired' ? '恢复自动复习' : '我已完全掌握 · 退出自动复习'}</button></div>`;
    }

    function start(review) {
      const lesson = selected();
      const questions = review ? course.weakQuestions(getState(), lesson.id) : lesson.questions;
      if (!questions.length) return;
      session = { lessonId: lesson.id, questions, review, index: 0, results: [], answered: false, selectedTiles: [], answer: '', correct: false };
      finished = null;
      render();
      $('courseReadInput')?.focus({ preventScroll: true });
    }

    function renderQuestion() {
      const lesson = selected();
      const question = session.questions[session.index];
      const progress = Math.round(session.index / session.questions.length * 100);
      const visual = question.type === 'listen'
        ? `<div class="course-listen"><button type="button" class="outline-button" data-course-audio="listen">▶ 播放日语句子</button><span>先听，不显示文字；提交后可以对照。</span></div>`
        : question.type === 'order' ? '' : `<div class="course-question-display" lang="ja">${html(question.display)}</div>`;
      const listenPrompt = ['meaning', 'read'].includes(question.type)
        ? `<div class="course-question-audio"><button type="button" class="outline-button" data-course-audio="question">▶ ${question.type === 'read' ? '听这个词' : '听这句话'}</button></div>` : '';
      const optionTypes = ['meaning', 'particle', 'listen'];
      const controls = optionTypes.includes(question.type)
        ? `<div class="course-options">${question.options.map((option, index) => `<button type="button" data-course-choice="${index}" ${session.answered ? 'disabled' : ''}><span>${index + 1}</span>${html(option)}</button>`).join('')}</div>`
        : question.type === 'read'
          ? `<form id="courseReadForm" autocomplete="off"><label for="courseReadInput">罗马字读音</label><div class="input-row"><input id="courseReadInput" inputmode="latin" autocapitalize="off" autocomplete="off" spellcheck="false" ${session.answered ? 'disabled' : ''} required placeholder="输入英文字母，按 Enter"><button type="submit" class="primary-button" ${session.answered ? 'disabled' : ''}>确认</button></div><p class="live-preview">假名预览 <strong id="courseReadPreview">—</strong></p></form>`
          : `<div class="course-order"><p>按顺序点选词块：</p><div class="course-order-selected" aria-label="已选词块">${session.selectedTiles.map((tile, index) => `<button type="button" data-course-undo="${index}" ${session.answered ? 'disabled' : ''}>${html(tile)} ×</button>`).join('') || '<span>从下方选择</span>'}</div><div class="course-order-tiles">${question.tiles.map((tile, index) => `<button type="button" data-course-tile="${index}" ${session.answered || session.selectedTiles.includes(tile) ? 'disabled' : ''}>${html(tile)}</button>`).join('')}</div><button type="button" class="primary-button" data-course-order-submit ${session.selectedTiles.length !== question.tiles.length || session.answered ? 'disabled' : ''}>确认句子</button></div>`;
      const feedback = session.answered ? `<div class="course-answer ${session.correct ? 'correct' : 'wrong'}" role="status"><strong>${session.correct ? '答对了' : '这题再记住一下'}</strong><p>${html(question.explain)}</p>${question.type === 'listen' ? `<p lang="ja">听到的是：${html(question.kana)}</p>` : ''}${!session.correct ? `<p>参考答案：${html(question.type === 'read' ? question.answers[0] : question.answer)}</p>` : ''}<button type="button" class="outline-button" data-course-audio="question">▶ ${['particle', 'order'].includes(question.type) ? '听完整句子' : '重听发音'}</button><button type="button" class="primary-button" data-course-next>${session.index === session.questions.length - 1 ? '查看本节结果' : '下一题'} →</button></div>` : '';
      $('coursePanel').innerHTML = `<div class="course-quiz-top"><button type="button" class="text-button" data-course-exit>← 返回课程</button><span>${session.review ? '错题回顾' : '八题挑战'} · ${session.index + 1}/${session.questions.length}</span></div><div class="course-quiz-bar"><span style="width:${progress}%"></span></div><div class="course-quiz"><span class="course-type">${typeLabels[question.type]}</span><h3>${html(question.prompt)}</h3>${visual}${listenPrompt}${controls}${feedback}<p class="course-keyboard-hint">按数字键选答案或词块；输入读音后按 Enter。提交后按 Enter 继续。</p><p id="courseAudioMessage" class="audio-message" role="status"></p></div>`;
      if (session.answered) $('coursePanel').querySelector('[data-course-next]')?.focus({ preventScroll: true });
    }

    function submit(answer) {
      if (!session || session.answered) return;
      const question = session.questions[session.index];
      session.answer = answer;
      session.correct = course.isCorrect(question, answer);
      session.answered = true;
      session.results.push({ id: question.id, correct: session.correct });
      renderQuestion();
    }

    function advance() {
      if (!session?.answered) return;
      if (session.index < session.questions.length - 1) {
        session.index += 1; session.answered = false; session.selectedTiles = []; session.answer = '';
        renderQuestion(); $('courseReadInput')?.focus({ preventScroll: true });
      } else {
        const ended = session;
        session = null;
        update(course.recordRun(getState(), ended.lessonId, ended.results, ended.review));
        finished = { lessonId: ended.lessonId, results: ended.results, review: ended.review };
        render();
      }
    }

    function renderFinished() {
      const lesson = selected();
      const score = finished.results.filter(result => result.correct).length;
      const total = finished.results.length;
      const status = course.getStatus(getState(), lesson.id);
      const weak = course.weakQuestions(getState(), lesson.id);
      const next = course.lessons[course.lessons.findIndex(entry => entry.id === lesson.id) + 1];
      $('coursePanel').innerHTML = `<div class="course-finished"><span>LESSON ${lesson.id} · ${finished.review ? '错题回顾' : '八题挑战'}</span><h3>${score} / ${total}</h3><p>${status === 'mastered' ? '八题中至少七题答对，且排序和读音题都答对；系统已标记为自动学会。' : status === 'retired' ? '你已手动确认学会，这节不会进入自动复习。' : '本节已经完成。可以继续下一节，或按需复习错题。'}</p><span class="course-badge ${status}">${statusLabels[status]}</span><div class="course-actions">${next ? `<button type="button" class="primary-button" data-course-next-lesson="${next.id}">去下一节 →</button>` : ''}${weak.length && status !== 'retired' ? `<button type="button" class="outline-button" data-course-start="review">只练 ${weak.length} 道错题</button>` : ''}<button type="button" class="text-button" data-course-intro>查看本节内容</button><button type="button" class="text-button" data-course-master>${status === 'retired' ? '恢复自动复习' : '我已完全掌握 · 退出自动复习'}</button></div></div>`;
    }

    $('courseView').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.courseSelect) {
        onLessonNavigate(button.dataset.courseSelect); return;
      }
      if (button.dataset.courseRecommend) {
        onLessonNavigate(button.dataset.courseRecommend); return;
      }
      if (button.dataset.courseFoundation) { onFoundationNavigate(button.dataset.courseFoundation); return; }
      if (button.dataset.courseFoundationComplete !== undefined) {
        const done = button.dataset.courseFoundationComplete === 'true';
        update({ ...getState(), foundationCompleted: done });
        if (done) onLessonNavigate('01');
        return;
      }
      if (button.dataset.courseVocab !== undefined) { onVocabNavigate(selectedId); return; }
      if (button.dataset.courseStart) { start(button.dataset.courseStart === 'review'); return; }
      if (button.dataset.courseMaster !== undefined) {
        const retired = course.getStatus(getState(), selectedId) === 'retired';
        update(course.setManualMastered(getState(), selectedId, !retired)); return;
      }
      if (button.dataset.courseIntro !== undefined || button.dataset.courseExit !== undefined) { session = null; finished = null; render(); return; }
      if (button.dataset.courseNextLesson) { onLessonNavigate(button.dataset.courseNextLesson); return; }
      if (button.dataset.courseAudio) {
        const lesson = selected();
        const kind = button.dataset.courseAudio;
        const question = session?.questions[session.index];
        if (kind === 'question' && !session.answered && ['particle', 'order'].includes(question.type)) return;
        const item = kind.startsWith('example') ? lesson.examples[Number(kind.slice(7))] : kind === 'listen' || kind === 'question' ? { kind: 'word', kana: question.spoken, audio: question.audio } : lesson.vocabulary[Number(kind.slice(1))];
        if (item) speak(item, 'courseAudioMessage'); return;
      }
      if (!session || session.answered) {
        if (button.dataset.courseNext !== undefined) advance();
        return;
      }
      const question = session.questions[session.index];
      if (button.dataset.courseChoice !== undefined) { submit(question.options[Number(button.dataset.courseChoice)]); return; }
      if (button.dataset.courseTile !== undefined) {
        session.selectedTiles.push(question.tiles[Number(button.dataset.courseTile)]); renderQuestion();
        $('coursePanel').querySelector('[data-course-tile]:not(:disabled), [data-course-order-submit]:not(:disabled)')?.focus({ preventScroll: true });
        return;
      }
      if (button.dataset.courseUndo !== undefined) {
        session.selectedTiles.splice(Number(button.dataset.courseUndo), 1); renderQuestion();
        $('coursePanel').querySelector('[data-course-tile]:not(:disabled)')?.focus({ preventScroll: true });
        return;
      }
      if (button.dataset.courseOrderSubmit !== undefined) submit(session.selectedTiles.join(' '));
    });
    $('courseView').addEventListener('submit', event => {
      if (event.target.id !== 'courseReadForm') return;
      event.preventDefault();
      const input = $('courseReadInput'); if (input?.value.trim()) submit(input.value);
    });
    $('courseView').addEventListener('input', event => {
      if (event.target.id !== 'courseReadInput') return;
      const target = $('courseReadPreview');
      if (target) target.textContent = root.KanaCore.convertRomaji(event.target.value, 'hiragana').text || '—';
    });
    $('courseView').addEventListener('keydown', event => {
      if (!session || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!session.answered && /^[1-9]$/.test(event.key) && event.target.tagName !== 'INPUT') {
        const index = Number(event.key) - 1;
        const selector = ['meaning', 'particle', 'listen'].includes(session.questions[session.index].type)
          ? `[data-course-choice="${index}"]` : `[data-course-tile="${index}"]`;
        const choice = $('coursePanel').querySelector(selector);
        if (choice && !choice.disabled) { event.preventDefault(); choice.click(); }
        return;
      }
      if (event.key !== 'Enter') return;
      if (session.answered) { event.preventDefault(); advance(); return; }
      if (event.target.tagName === 'INPUT') return;
      if (event.target.tagName === 'BUTTON') return;
    });
    function reset() { session = null; finished = null; selectedId = initialSelection(); render(); }
    return { render, reset, select };
  }
  root.CourseUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : window);
