(function (root) {
  'use strict';

  const pitch = root.PitchCore;
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function compact(reading) {
    const entry = pitch.lookup(reading);
    if (!entry) return '';
    const types = entry.accents.map(accent => `${accent} 型`).join(' / ');
    return `<span class="pitch-compact" aria-label="${html(reading)}的东京式音调：${html(entry.accents.map(pitch.label).join('；'))}">音调 ${html(types)}${entry.source === 'openjtalk' ? ' · 推定' : ''}</span>`;
  }

  function render(reading) {
    const entry = pitch.lookup(reading);
    if (!entry) return '';
    const variants = entry.accents.map(accent => {
      const sequence = pitch.pattern(reading, accent);
      return `<div class="pitch-variant"><span class="pitch-type">${html(pitch.label(accent))}</span><span class="pitch-sequence" role="img" aria-label="${html(reading)}：${html(sequence.map(item => `${item.mora}${item.level === 'high' ? '高' : '低'}${item.dropAfter ? '后降调' : ''}`).join('，'))}">${sequence.map(item => `<span class="pitch-mora ${item.level}"><span lang="ja">${html(item.mora)}</span><small>${item.level === 'high' ? '高' : '低'}</small></span>${item.dropAfter ? '<span class="pitch-fall" aria-hidden="true">↘</span>' : ''}`).join('')}</span></div>`;
    }).join('');
    const note = entry.source === 'openjtalk' ? '本词由 Open JTalk 推定；合成读音可能与音调图不同。' : entry.accents.length > 1 ? '这个词有多种常见音调。' : '';
    return `<div class="pitch-guide" aria-label="东京式高低音调">${variants}${note ? `<small class="pitch-note">${html(note)}</small>` : ''}</div>`;
  }

  root.PitchUI = { compact, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
