(function (root) {
  'use strict';

  const vocab = root.VocabCore;
  const $ = id => document.getElementById(id);
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const labels = { unseen: '未开始', learning: '练习中', retired: '已经学会' };

  function create({ getState, onStateChange, speak }) {
    let selectedId = vocab.chapters[0].id;
    let session = null;

    function chapter() { return vocab.byChapter.get(selectedId); }
    function select(id) {
      if (!vocab.byChapter.has(id)) return;
      selectedId = id;
      session = null;
      render();
    }
    function render() {
      const picker = $('vocabChapter');
      if (!picker.options.length) picker.innerHTML = vocab.chapters.map(entry => `<option value="${entry.id}">第 ${entry.id} 课 · ${html(entry.title)}</option>`).join('');
      picker.value = selectedId;
      const state = getState();
      const words = chapter().words;
      const mastered = words.filter(word => vocab.getStatus(state, word.id) === 'retired').length;
      $('vocabSummary').textContent = `本课 ${words.length} 个单词 · ${mastered} 个已经学会 · ${words.length - mastered} 个待练`;
      $('vocabGrid').innerHTML = words.map(word => {
        const status = vocab.getStatus(state, word.id);
        return `<article class="vocab-card ${status === 'retired' ? 'vocab-card-mastered' : ''}"><div class="vocab-card-top"><span class="vocab-status ${status}">${labels[status]}</span><span>第 ${selectedId} 课</span></div><strong lang="ja">${html(word.kana)}</strong><span class="vocab-reading">${html(word.romaji)}</span><p>${html(word.meaning)}</p><div class="vocab-card-actions"><button type="button" data-vocab-audio="${html(word.id)}">▶ 听发音</button><button type="button" data-vocab-master="${html(word.id)}" aria-pressed="${status === 'retired'}">${status === 'retired' ? '恢复练习' : '标为已经学会'}</button></div></article>`;
      }).join('');
      $('vocabStart').disabled = mastered === words.length;
      $('vocabStart').textContent = mastered === words.length ? '本课单词已全部学会' : `练习本课 ${words.length - mastered} 个待学单词 →`;
      renderPractice();
    }
    function renderPractice() {
      const panel = $('vocabPractice');
      panel.hidden = !session;
      if (!session) return;
      while (!session.answered && session.index < session.deck.length && vocab.getStatus(getState(), session.deck[session.index].word.id) === 'retired') session.index++;
      if (session.index >= session.deck.length) {
        const correct = session.results.filter(result => result).length;
        panel.innerHTML = `<div class="vocab-practice-done"><span class="section-kicker">本轮完成</span><h3>${correct} / ${session.results.length}</h3><p>已学会的词不会进入下一轮；需要重练时，可以在上方词卡恢复练习。</p><button type="button" class="outline-button" data-vocab-restart>再练一轮</button></div>`;
        return;
      }
      const question = session.deck[session.index];
      const response = question.type === 'read'
        ? `<form id="vocabAnswerForm" autocomplete="off"><label for="vocabAnswer">输入罗马字读音</label><div class="input-row"><input id="vocabAnswer" inputmode="latin" autocapitalize="off" autocomplete="off" spellcheck="false" required placeholder="输入读音，按 Enter" ${session.answered ? 'disabled' : ''}><button type="submit" class="primary-button" ${session.answered ? 'disabled' : ''}>确认</button></div></form>`
        : `<div class="vocab-options">${question.options.map((option, index) => `<button type="button" data-vocab-choice="${index}" ${session.answered ? 'disabled' : ''}><span>${index + 1}</span>${html(option)}</button>`).join('')}</div>`;
      panel.innerHTML = `<div class="vocab-practice-head"><span>${question.type === 'read' ? '读音练习' : '词义练习'} · ${session.index + 1}/${session.deck.length}</span><button type="button" class="text-button" data-vocab-close>结束本轮</button></div><div class="vocab-practice-question"><strong lang="ja">${html(question.word.kana)}</strong><button type="button" class="outline-button" data-vocab-play>▶ 听发音</button></div><h3>${question.type === 'read' ? '这个词怎么读？' : '这个词是什么意思？'}</h3>${response}${session.answered ? `<div class="vocab-feedback ${session.correct ? 'correct' : 'wrong'}" role="status"><strong>${session.correct ? '答对了' : '再记住这个词'}</strong><p>${html(question.word.kana)} · ${html(question.word.romaji)} · ${html(question.word.meaning)}</p><button type="button" class="primary-button" data-vocab-next>${session.index === session.deck.length - 1 ? '查看结果' : '下一题'} →</button></div>` : ''}`;
      if (session.answered) panel.querySelector('[data-vocab-next]')?.focus({ preventScroll: true });
    }
    function start() {
      const deck = vocab.buildDeck(getState(), selectedId);
      if (!deck.length) { session = null; render(); return; }
      session = { deck, index: 0, answered: false, correct: false, results: [] };
      renderPractice();
      $('vocabPractice').scrollIntoView({ block: 'start', behavior: 'smooth' });
      $('vocabAnswer')?.focus({ preventScroll: true });
    }
    function submit(response) {
      if (!session || session.answered || session.index >= session.deck.length) return;
      const question = session.deck[session.index];
      session.correct = vocab.isCorrect(question, response);
      session.answered = true;
      session.results.push(session.correct);
      onStateChange(vocab.recordAnswer(getState(), question.word.id, question.type, session.correct));
      render();
    }
    function advance() {
      if (!session?.answered) return;
      session.index++;
      session.answered = false;
      renderPractice();
      $('vocabAnswer')?.focus({ preventScroll: true });
    }

    $('vocabChapter').addEventListener('change', event => select(event.target.value));
    $('vocabGrid').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.vocabAudio) {
        const word = chapter().words.find(entry => entry.id === button.dataset.vocabAudio);
        if (word) speak(word, 'vocabAudioMessage');
      }
      if (button.dataset.vocabMaster) {
        const id = button.dataset.vocabMaster;
        const mastered = vocab.getStatus(getState(), id) !== 'retired';
        onStateChange(vocab.setManualMastered(getState(), id, mastered));
        if (mastered && session && !session.answered && session.deck[session.index]?.word.id === id) session.index++;
        render();
      }
    });
    $('vocabStart').addEventListener('click', start);
    $('vocabPractice').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.vocabClose !== undefined) { session = null; renderPractice(); return; }
      if (button.dataset.vocabRestart !== undefined) { start(); return; }
      if (button.dataset.vocabPlay !== undefined) { speak(session.deck[session.index].word, 'vocabAudioMessage'); return; }
      if (button.dataset.vocabNext !== undefined) { advance(); return; }
      if (button.dataset.vocabChoice !== undefined) submit(session.deck[session.index].options[Number(button.dataset.vocabChoice)]);
    });
    $('vocabPractice').addEventListener('submit', event => {
      if (event.target.id !== 'vocabAnswerForm') return;
      event.preventDefault();
      const answer = $('vocabAnswer')?.value.trim();
      if (answer) submit(answer);
    });
    $('vocabPractice').addEventListener('keydown', event => {
      if (event.key === 'Enter' && session?.answered) { event.preventDefault(); advance(); }
    });
    function reset() { session = null; render(); }
    return { render, select, reset };
  }

  root.VocabUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : window);
