// Dependency-free, invisible Chrome DevTools smoke test for the local or deployed page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kana-cdp-'));
const pageUrl = process.env.PAGE_URL || pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitForPort() {
  const file = path.join(profile, 'DevToolsActivePort');
  for (let n = 0; n < 100; n++) {
    if (fs.existsSync(file)) return Number(fs.readFileSync(file, 'utf8').split('\n')[0]);
    if (browser.exitCode !== null) throw new Error(`Chrome exited: ${browser.exitCode}`);
    await sleep(100);
  }
  throw new Error('Chrome DevTools port did not appear');
}
async function main() {
  const port = await waitForPort();
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find(entry => entry.type === 'page');
  assert.ok(tab, 'Chrome has a page target');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = ++id; pending.set(commandId, { resolve, reject });
      ws.send(JSON.stringify({ id: commandId, method, params }));
    });
  }
  async function pressEnter() {
    const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
    await send('Input.dispatchKeyEvent', { type: 'char', text: '\r', unmodifiedText: '\r', ...key });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
  async function viewport(width, height, isMobile) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: isMobile });
  }
  async function screenshot(file) {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  }
  await send('Page.enable'); await send('Runtime.enable');
  await viewport(1365, 900, false);
  await send('Page.navigate', { url: pageUrl });
  await sleep(800);
  assert.equal(await evaluate('document.title'), '假名练习室 · 五十音识读');
  assert.equal(await evaluate('document.querySelectorAll(".kana-card").length'), 46);
  assert.equal(await evaluate('document.getElementById("countTotal").textContent'), '117');
  const desktopShot = path.join(os.tmpdir(), 'kana-desktop-cdp.png');
  await screenshot(desktopShot);

  const direct = await evaluate(`(() => {
    document.getElementById('heroPractice').click();
    return { pool: document.getElementById('practicePool').value, empty: document.getElementById('practiceEmpty').hidden, glyph: document.getElementById('questionGlyph').textContent, started: document.getElementById('countStarted').textContent };
  })()`);
  assert.equal(direct.pool, 'all');
  assert.equal(direct.empty, true);
  assert.ok(direct.glyph.length > 0);
  assert.equal(direct.started, '0');
  const directAnswer = await evaluate(`(() => {
    const glyph = document.getElementById('questionGlyph').textContent;
    const item = window.KanaCore.items.find(entry => entry.script === 'hiragana' && entry.kana === glyph);
    const input = document.getElementById('practiceInput'); input.value = item.romaji; input.dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('practiceForm').requestSubmit();
    const started = document.getElementById('countStarted').textContent;
    const saved = JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records[item.id].manualLearned;
    window.confirm = () => true;
    document.getElementById('resetProgress').click();
    return { started, saved, afterReset: document.getElementById('countStarted').textContent };
  })()`);
  assert.deepEqual(directAnswer, { started: '1', saved: true, afterReset: '0' });

  const manual = await evaluate(`(() => {
    document.querySelector('[data-view="learn"]').click();
    document.querySelectorAll('.card-mark')[1].click();
    const marked = document.getElementById('countStarted').textContent;
    document.querySelector('[data-view="practice"]').click();
    const pool = document.getElementById('practicePool'); pool.value = 'learned'; pool.dispatchEvent(new Event('change', {bubbles:true}));
    const glyph = document.getElementById('questionGlyph').textContent;
    document.querySelector('[data-view="learn"]').click();
    document.querySelectorAll('.card-mark')[1].click();
    return { marked, glyph, unmarked: document.getElementById('countStarted').textContent };
  })()`);
  assert.deepEqual(manual, { marked: '1', glyph: 'い', unmarked: '0' });

  const speech = await evaluate(`(() => {
    document.querySelector('.card-open').click();
    document.getElementById('detailAudio').click();
    return { voices: speechSynthesis.getVoices().filter(voice => /^ja(?:-|$)/i.test(voice.lang)).length, message: document.getElementById('detailAudioMessage').textContent, audio: window.KanaCore.items.find(item => item.id === 'hiragana:base:a').audio };
  })()`);
  assert.equal(speech.audio, 'audio/base-a.mp3');
  assert.doesNotMatch(speech.message, /未检测到日语语音/);

  const detailPrepared = await evaluate(`(() => {
    document.getElementById('detailStart').click();
    const input = document.getElementById('detailInput'); input.value = 'a'; input.dispatchEvent(new Event('input', {bubbles:true}));
    input.focus();
    return document.getElementById('detailPreview').textContent;
  })()`);
  assert.equal(detailPrepared, 'あ');
  await pressEnter();
  const detailAdvanced = await evaluate(`({ glyph: document.getElementById('detailGlyph').textContent, focused: document.activeElement === document.getElementById('detailInput'), saved: JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records['hiragana:base:a'].attemptCount })`);
  assert.deepEqual(detailAdvanced, { glyph: 'い', focused: true, saved: 1 });

  const practicePrepared = await evaluate(`(() => {
    document.getElementById('closeDetail').click();
    document.querySelector('[data-view="practice"]').click();
    const glyph = document.getElementById('questionGlyph').textContent;
    const input = document.getElementById('practiceInput'); input.value = 'a'; input.dispatchEvent(new Event('input', {bubbles:true}));
    input.focus();
    return { glyph, preview: document.getElementById('practicePreview').textContent };
  })()`);
  assert.deepEqual(practicePrepared, { glyph: 'あ', preview: 'あ' });
  await pressEnter();
  const practiceAdvanced = await evaluate(`({ counter: document.getElementById('questionCounter').textContent, feedback: document.getElementById('practiceFeedback').textContent, focused: document.activeElement === document.getElementById('practiceInput'), audioHidden: document.getElementById('questionAudio').hidden, previous: document.getElementById('previousReading').textContent, previousShown: !document.getElementById('previousAnswer').hidden })`);
  assert.equal(practiceAdvanced.counter, '第 3 题');
  assert.match(practiceAdvanced.feedback, /上一题答对/);
  assert.equal(practiceAdvanced.focused, true);
  assert.equal(practiceAdvanced.audioHidden, true);
  assert.equal(practiceAdvanced.previous, 'あ · a');
  assert.equal(practiceAdvanced.previousShown, true);

  await evaluate(`(() => { const input = document.getElementById('practiceInput'); input.value = 'zzz'; input.dispatchEvent(new Event('input', {bubbles:true})); input.focus(); })()`);
  await pressEnter();
  const wrong = await evaluate(`({ counter: document.getElementById('questionCounter').textContent, feedback: document.getElementById('practiceFeedback').textContent, focused: document.activeElement === document.getElementById('nextQuestion'), audioVisible: !document.getElementById('questionAudio').hidden })`);
  assert.equal(wrong.counter, '第 3 题');
  assert.match(wrong.feedback, /再记住它/);
  assert.equal(wrong.focused, true);
  assert.equal(wrong.audioVisible, true);
  await pressEnter();
  const afterWrong = await evaluate(`({ counter: document.getElementById('questionCounter').textContent, focused: document.activeElement === document.getElementById('practiceInput') })`);
  assert.deepEqual(afterWrong, { counter: '第 4 题', focused: true });

  const persisted = await evaluate(`(() => {
    const saved = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
    return saved.records['hiragana:base:a'].attemptCount;
  })()`);
  assert.equal(persisted, 3);

  const result = await evaluate(`(() => {
    document.querySelector('[data-view="convert"]').click();
    const input = document.getElementById('convertInput'); input.value = 'kippu'; input.dispatchEvent(new Event('input', {bubbles:true}));
    const hiragana = document.getElementById('convertOutput').textContent;
    document.querySelector('[data-convert-script="katakana"]').click();
    return { hiragana, katakana: document.getElementById('convertOutput').textContent };
  })()`);
  assert.deepEqual(result, { hiragana: 'きっぷ', katakana: 'キップ' });

  const wordDetail = await evaluate(`(() => {
    document.querySelector('[data-group="special"]').click();
    document.querySelector('[data-view="learn"]').click();
    document.querySelector('.card-open').click();
    const result = { glyph: document.getElementById('detailGlyph').textContent, meaning: document.getElementById('detailMeaning').textContent, rhythm: document.getElementById('detailRhythm').textContent };
    document.getElementById('closeDetail').click();
    document.querySelector('[data-group="base"]').click();
    return result;
  })()`);
  assert.deepEqual(wordDetail, { glyph: 'きっぷ', meaning: '意思：车票', rhythm: '节拍：き・停一拍・ぷ' });
  const clip = await evaluate(`new Promise((resolve, reject) => {
    const audio = new Audio('audio/special-kippu.mp3');
    audio.onloadedmetadata = () => resolve({ duration: audio.duration, source: audio.currentSrc });
    audio.onerror = () => reject(new Error('local MP3 could not load'));
    audio.load();
  })`);
  assert.ok(clip.duration > 0.5 && clip.duration < 3);
  assert.match(clip.source, /special-kippu\.mp3$/);

  const backup = await evaluate(`(async () => {
    URL.createObjectURL = blob => { window.__exportedBlob = blob; return 'blob:smoke'; };
    HTMLAnchorElement.prototype.click = function () { window.__downloadName = this.download; };
    document.getElementById('exportProgress').click();
    const exported = JSON.parse(await window.__exportedBlob.text());
    const original = JSON.stringify(exported);
    window.confirm = () => true;
    document.getElementById('resetProgress').click();
    const resetCount = Object.keys(JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records).length;
    const file = new File([original], 'saved.json', {type:'application/json'});
    const transfer = new DataTransfer(); transfer.items.add(file);
    const input = document.getElementById('importProgress'); input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    return { name: window.__downloadName, resetCount, restored: JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records['hiragana:base:a'].attemptCount, message: document.getElementById('storageMessage').textContent };
  })()`);
  assert.match(backup.name, /^kana-progress-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(backup.resetCount, 0);
  assert.equal(backup.restored, 3);
  assert.match(backup.message, /已导入/);

  await viewport(390, 844, true);
  await send('Page.navigate', { url: pageUrl });
  await sleep(800);
  await evaluate(`(() => { document.querySelector('[data-mode="hiragana"]').click(); document.querySelector('[data-view="learn"]').click(); })()`);
  await evaluate('document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0)');
  await sleep(300);
  const mobile = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cardCount: document.querySelectorAll(".kana-card").length })');
  assert.equal(mobile.width, 390);
  assert.equal(mobile.cardCount, 46);
  assert.ok(mobile.scrollWidth <= mobile.width, `horizontal overflow: ${mobile.scrollWidth} > ${mobile.width}`);
  const mobileShot = path.join(os.tmpdir(), 'kana-mobile-cdp.png');
  await screenshot(mobileShot);
  await evaluate('document.getElementById("learnView").scrollIntoView({block:"start",behavior:"instant"})');
  const mobileChartShot = path.join(os.tmpdir(), 'kana-mobile-chart-cdp.png');
  await screenshot(mobileChartShot);
  const mobilePractice = await evaluate(`(() => {
    document.querySelector('[data-view="practice"]').click();
    return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, audioHidden: document.getElementById('questionAudio').hidden, saved: JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records['hiragana:base:a'].attemptCount };
  })()`);
  assert.ok(mobilePractice.scrollWidth <= mobilePractice.width, 'practice has no horizontal overflow');
  assert.equal(mobilePractice.audioHidden, true);
  assert.equal(mobilePractice.saved, 3);
  await evaluate('document.getElementById("practiceView").scrollIntoView({block:"start",behavior:"instant"})');
  const mobilePracticeShot = path.join(os.tmpdir(), 'kana-mobile-practice-cdp.png');
  await screenshot(mobilePracticeShot);
  await viewport(320, 700, true);
  await send('Page.navigate', { url: pageUrl });
  await sleep(500);
  const narrow = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })');
  assert.ok(narrow.scrollWidth <= narrow.width, `narrow mobile overflow: ${narrow.scrollWidth} > ${narrow.width}`);
  console.log(JSON.stringify({ passed: true, desktopShot, mobileShot, mobileChartShot, mobilePracticeShot, mobile, mobilePractice, narrow }));
  ws.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  browser.kill();
  await sleep(250);
  const temp = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(temp)) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
