(function (root) {
  'use strict';

  const pitch = root.PitchCore;
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function render(reading) {
    const entry = pitch.lookup(reading);
    if (!entry) return '';
    const variants = entry.accents.map(accent => {
      const sequence = pitch.pattern(reading, accent);
      return `<div class="pitch-variant"><span class="pitch-type">${html(pitch.label(accent, reading))}</span><span class="pitch-sequence" role="img" aria-label="${html(reading)}：${html(sequence.map(item => `${item.mora}${item.level === 'high' ? '高' : '低'}${item.dropAfter ? '后降调' : ''}`).join('，'))}">${sequence.map(item => `<span class="pitch-mora ${item.level}"><span lang="ja">${html(item.mora)}</span><small>${item.level === 'high' ? '高' : '低'}</small></span>${item.dropAfter ? '<span class="pitch-fall" aria-hidden="true">↘</span>' : ''}`).join('')}</span></div>`;
    }).join('');
    const source = { irodori: '《いろどり》词表', ojad: '东京大学 OJAD', openjtalk: 'Open JTalk 推定' }[entry.source] || '词典资料';
    const note = `来源：${source}。这是东京式音调参考，本页合成音频未按此图逐词校准。${entry.accents.length > 1 ? '这个词有多种常见音调。' : ''}`;
    return `<details class="pitch-reference"><summary>查看辞典音调</summary><div class="pitch-guide" aria-label="东京式高低音调参考">${variants}<small class="pitch-note">${html(note)}</small></div></details>`;
  }

  root.PitchUI = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
