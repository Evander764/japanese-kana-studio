(function (root) {
  'use strict';

  const data = root.PitchData || (typeof require === 'function' ? require('./pitch-data.js') : {});
  const smallKana = /[ゃゅょャュョぁぃぅぇぉァィゥェォ]/;

  function splitMoras(reading) {
    const result = [];
    for (const char of reading) {
      if (smallKana.test(char) && result.length) result[result.length - 1] += char;
      else result.push(char);
    }
    return result;
  }

  function pattern(reading, accent) {
    const moras = splitMoras(reading);
    if (!Number.isInteger(accent) || accent < 0 || accent > moras.length) return null;
    return moras.map((mora, index) => ({
      mora,
      level: accent === 1 ? (index === 0 ? 'high' : 'low') : (index === 0 ? 'low' : accent === 0 || index < accent ? 'high' : 'low'),
      dropAfter: accent > 0 && index + 1 === accent
    }));
  }

  function lookup(reading) { return data[reading] || null; }
  function label(accent) { return accent === 0 ? '0 型 · 词内不降调' : `${accent} 型 · 第 ${accent} 拍后下降`; }
  const api = { data, lookup, splitMoras, pattern, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PitchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
