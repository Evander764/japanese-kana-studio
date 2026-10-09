(function (root) {
  'use strict';

  const pitch = root.PitchCore;
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function render(reading) {
    const entry = pitch.lookup(reading);
    if (!entry) return '';
    const variants = entry.accents.map((accent, index) => {
      const sequence = pitch.pattern(reading, accent);
      return `<div class="pitch-variant"><span class="pitch-type">${index === 0 ? '音频采用 · ' : '另一种常见读法 · '}${html(pitch.label(accent, reading))}</span><span class="pitch-sequence" role="img" aria-label="${html(reading)}：${html(sequence.map(item => `${item.mora}${item.level === 'high' ? '高' : '低'}${item.dropAfter ? '后降调' : ''}`).join('，'))}">${sequence.map(item => `<span class="pitch-mora ${item.level}"><span lang="ja">${html(item.mora)}</span><small>${item.level === 'high' ? '高' : '低'}</small></span>${item.dropAfter ? '<span class="pitch-fall" aria-hidden="true">↘</span>' : ''}`).join('')}</span></div>`;
    }).join('');
    const source = { irodori: '《いろどり》词表', ojad: '东京大学 OJAD', openjtalk: 'Open JTalk 推定' }[entry.source] || '词典资料';
    const note = `来源：${source}。播放音频按第一种音调逐拍设定并合成；清化的音节和词尾降调在单独读词时可能听不出来。${entry.source === 'openjtalk' ? '此词型为机器推定。' : ''}`;
    return `<details class="pitch-reference"><summary>音频音调：${html(entry.accents[0])} 型 · 查看高低图</summary><div class="pitch-guide" aria-label="东京式高低音调参考">${variants}<small class="pitch-note">${html(note)}</small></div></details>`;
  }

  root.PitchUI = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
