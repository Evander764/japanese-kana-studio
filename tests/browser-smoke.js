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
  ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
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
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function waitForApp() {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate('document.querySelectorAll(".kana-card").length === 46')) return;
      await sleep(200);
    }
    throw new Error('App did not initialize: ' + await evaluate('JSON.stringify({url:location.href,ready:document.readyState,scripts:[...document.scripts].map(node=>node.src)})'));
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
  await waitForApp();
  assert.equal(await evaluate('document.title'), '日语起步 · 从零开始学日语');
  assert.equal(await evaluate('!document.getElementById("courseView").hidden && document.getElementById("learnView").hidden'), true);
  assert.equal(await evaluate('document.querySelector("[data-course-select]").dataset.courseSelect'), '00');
  assert.equal(await evaluate('document.querySelectorAll(".kana-card").length'), 46);
  assert.equal(await evaluate('document.getElementById("countTotal").textContent'), '117');
  const desktopShot = path.join(os.tmpdir(), 'kana-desktop-cdp.png');
  await screenshot(desktopShot);
  const readingToggle = await evaluate(`(() => {
    const button = document.getElementById('romajiToggle');
    const heroReading = document.getElementById('heroSampleRomaji');
    const heroInitiallyVisible = getComputedStyle(heroReading).display !== 'none';
    document.querySelector('[data-view="learn"]').click();
    const kanaReading = document.querySelector('.card-reading');
    const initiallyVisible = getComputedStyle(kanaReading).display !== 'none';
    button.click();
    const heroHidden = getComputedStyle(heroReading).display === 'none';
    const kanaHidden = getComputedStyle(kanaReading).display === 'none';
    document.querySelector('[data-view="course"]').click();
    document.querySelector('[data-course-select="01"]').click();
    const exampleHidden = getComputedStyle(document.querySelector('.course-example [data-romaji]')).display === 'none';
    document.querySelector('[data-view="vocab"]').click();
    const vocabHidden = getComputedStyle(document.querySelector('.vocab-reading')).display === 'none';
    const savedHidden = JSON.parse(localStorage.getItem('kana-studio-progress-v1')).showRomaji === false;
    button.click();
    const restored = getComputedStyle(document.querySelector('.vocab-reading')).display !== 'none';
    return {heroInitiallyVisible,initiallyVisible,heroHidden,kanaHidden,exampleHidden,vocabHidden,savedHidden,restored,pressed:button.getAttribute('aria-pressed')};
  })()`);
  assert.deepEqual(readingToggle, {heroInitiallyVisible:true,initiallyVisible:true,heroHidden:true,kanaHidden:true,exampleHidden:true,vocabHidden:true,savedHidden:true,restored:true,pressed:'true'});
  const versionedAudio = await evaluate(`new Promise((resolve, reject) => {
    const clip = new Audio('audio/base-a.mp3?v=20261008-2');
    clip.onloadedmetadata = () => resolve(clip.duration > 0.2);
    clip.onerror = () => reject(new Error('versioned local audio did not load'));
  })`);
  assert.equal(versionedAudio, true);
  const heroAudio = await evaluate(`(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    const clips = [];
    let firstClip;
    HTMLMediaElement.prototype.play = function () { if (!firstClip) firstClip = this; clips.push({correctSource:new URL(this.src).pathname.endsWith('/audio/course-01-example.mp3'),rate:this.playbackRate}); return Promise.resolve(); };
    document.getElementById('heroAudio').click();
    document.querySelector('.hero-listen-card [data-audio-speed="slow"]').click();
    const changedWhilePlaying = firstClip.playbackRate;
    document.getElementById('heroAudio').click();
    const courseSlow = document.querySelector('#courseView [data-audio-speed="slow"]').getAttribute('aria-pressed');
    document.querySelector('.hero-listen-card [data-audio-speed="normal"]').click();
    const restored = document.querySelector('#courseView [data-audio-speed="normal"]').getAttribute('aria-pressed');
    HTMLMediaElement.prototype.play = originalPlay;
    return { clips, changedWhilePlaying, courseSlow, restored, saved:JSON.parse(localStorage.getItem('kana-studio-progress-v1')).audioSpeed, sample:document.getElementById('heroSampleKana').textContent === window.CourseData.lessons[0].example.kana };
  })()`);
  assert.deepEqual(heroAudio, { clips:[{correctSource:true,rate:1},{correctSource:true,rate:0.78}], changedWhilePlaying:0.78, courseSlow:'true', restored:'true', saved:'normal', sample:true });

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
    const originalPlay = HTMLMediaElement.prototype.play;
    let source = '';
    HTMLMediaElement.prototype.play = function () { source = this.src; return Promise.resolve(); };
    document.getElementById('detailTestAudio').click();
    HTMLMediaElement.prototype.play = originalPlay;
    return { preview: document.getElementById('detailPreview').textContent, audioVisible: !document.getElementById('detailTestAudio').hidden, answerHidden: document.getElementById('detailAnswer').hidden, focused: document.activeElement === input, input: input.value, source };
  })()`);
  assert.deepEqual({ ...detailPrepared, source: new URL(detailPrepared.source).pathname.endsWith('/audio/base-a.mp3') }, { preview: 'あ', audioVisible: true, answerHidden: true, focused: true, input: 'a', source: true });
  await pressEnter();
  const detailAdvanced = await evaluate(`({ glyph: document.getElementById('detailGlyph').textContent, focused: document.activeElement === document.getElementById('detailInput'), saved: JSON.parse(localStorage.getItem('kana-studio-progress-v1')).records['hiragana:base:a'].attemptCount })`);
  assert.deepEqual(detailAdvanced, { glyph: 'い', focused: true, saved: 1 });

  const practicePrepared = await evaluate(`(() => {
    document.getElementById('closeDetail').click();
    document.querySelector('[data-view="practice"]').click();
    const glyph = document.getElementById('questionGlyph').textContent;
    const input = document.getElementById('practiceInput'); input.value = 'a'; input.dispatchEvent(new Event('input', {bubbles:true}));
    input.focus();
    const originalPlay = HTMLMediaElement.prototype.play;
    let source = '';
    HTMLMediaElement.prototype.play = function () { source = this.src; return Promise.resolve(); };
    document.getElementById('questionAudio').click();
    HTMLMediaElement.prototype.play = originalPlay;
    return { glyph, preview: document.getElementById('practicePreview').textContent, audioVisible: !document.getElementById('questionAudio').hidden, focused: document.activeElement === input, input: input.value, source };
  })()`);
  assert.deepEqual({ ...practicePrepared, source: new URL(practicePrepared.source).pathname.endsWith('/audio/base-a.mp3') }, { glyph: 'あ', preview: 'あ', audioVisible: true, focused: true, input: 'a', source: true });
  await pressEnter();
  const practiceAdvanced = await evaluate(`({ counter: document.getElementById('questionCounter').textContent, feedback: document.getElementById('practiceFeedback').textContent, focused: document.activeElement === document.getElementById('practiceInput'), audioHidden: document.getElementById('questionAudio').hidden, previous: document.getElementById('previousReading').textContent, previousShown: !document.getElementById('previousAnswer').hidden })`);
  assert.equal(practiceAdvanced.counter, '第 3 题');
  assert.match(practiceAdvanced.feedback, /上一题答对/);
  assert.equal(practiceAdvanced.focused, true);
  assert.equal(practiceAdvanced.audioHidden, false);
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

  const priorProgress = await evaluate(`localStorage.getItem('kana-studio-progress-v1')`);
  const journeyStart = await evaluate(`(() => {
    document.getElementById('heroJourney').click();
    return { mode: document.querySelector('[data-mode="mixed"]').classList.contains('active'), pool: document.getElementById('practicePool').value, groupDisabled: document.getElementById('practiceGroup').disabled, glyph: document.getElementById('questionGlyph').textContent, banner: !document.getElementById('journeyProgress').hidden };
  })()`);
  assert.deepEqual(journeyStart, { mode: true, pool: 'journey', groupDisabled: true, glyph: 'ア', banner: true });
  // The restored backup already contains one answer for あ, so the journey starts at ア.
  const journeyShot = path.join(os.tmpdir(), 'kana-journey-cdp.png');
  await evaluate('document.getElementById("practiceView").scrollIntoView({block:"start",behavior:"instant"})');
  await screenshot(journeyShot);
  const journeyRun = await evaluate(`(() => {
    const seen = [];
    for (let turn = 0; turn < 7; turn++) {
      const glyph = document.getElementById('questionGlyph').textContent;
      seen.push({ glyph, kind: document.getElementById('questionKind').textContent });
      const item = window.KanaCore.items.find(entry => entry.kana === glyph);
      const input = document.getElementById('practiceInput');
      input.value = item.romaji; input.dispatchEvent(new Event('input', {bubbles:true}));
      document.getElementById('practiceForm').requestSubmit();
    }
    const saved = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
    return { seen, turns: saved.journeyTurns, streak: saved.journeyStreak, nextKind: document.getElementById('questionKind').textContent, started: document.getElementById('journeyStarted').textContent };
  })()`);
  assert.deepEqual(journeyRun.seen.slice(0, 5).map(entry => entry.glyph), ['ア', 'い', 'イ', 'う', 'ウ']);
  assert.equal(journeyRun.turns, 7);
  assert.equal(journeyRun.streak, 7);
  assert.match(journeyRun.nextKind, /复习/);
  assert.match(journeyRun.started, /^7 \/ 242/);
  await viewport(390, 844, true);
  const mobileJourney = await evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, banner: !document.getElementById('journeyProgress').hidden, groupDisabled: document.getElementById('practiceGroup').disabled })`);
  assert.deepEqual(mobileJourney, { width: 390, scrollWidth: 390, banner: true, groupDisabled: true });
  await evaluate('document.getElementById("practiceView").scrollIntoView({block:"start",behavior:"instant"})');
  const mobileJourneyShot = path.join(os.tmpdir(), 'kana-mobile-journey-cdp.png');
  await screenshot(mobileJourneyShot);
  await evaluate(`localStorage.setItem('kana-studio-progress-v1', ${JSON.stringify(priorProgress)})`);

  await send('Page.navigate', { url: pageUrl });
  await waitForApp();
  await evaluate(`(() => { document.querySelector('[data-mode="hiragana"]').click(); document.querySelector('[data-view="learn"]').click(); })()`);
  await evaluate('document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0)');
  await sleep(300);
  const mobile = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cardCount: document.querySelectorAll(".kana-card").length })');
  assert.equal(mobile.width, 390);
  assert.equal(mobile.cardCount, 46);
  assert.ok(mobile.scrollWidth <= mobile.width, `horizontal overflow: ${mobile.scrollWidth} > ${mobile.width}`);
  const mobileToggle = await evaluate(`(() => { const el = document.getElementById('romajiToggle'); const box = el.getBoundingClientRect(); const brand = document.querySelector('.brand').getBoundingClientRect(); return {x:box.x,y:box.y,width:box.width,height:box.height,display:getComputedStyle(el).display,brandRight:brand.right,topElement:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.id}; })()`);
  assert.ok(mobileToggle.x >= 0 && mobileToggle.x + mobileToggle.width <= 390 && mobileToggle.y >= 0 && mobileToggle.y < 100 && mobileToggle.topElement === 'romajiToggle' && mobileToggle.x >= mobileToggle.brandRight, 'romaji toggle visible in mobile header: ' + JSON.stringify(mobileToggle));
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
  assert.equal(mobilePractice.audioHidden, false);
  assert.equal(mobilePractice.saved, 3);
  await evaluate('document.getElementById("practiceView").scrollIntoView({block:"start",behavior:"instant"})');
  const mobilePracticeShot = path.join(os.tmpdir(), 'kana-mobile-practice-cdp.png');
  await screenshot(mobilePracticeShot);
  const mobileSelfTest = await evaluate(`(() => {
    document.querySelector('[data-view="learn"]').click();
    document.querySelector('.card-open').click();
    document.getElementById('detailStart').click();
    return { audioVisible: !document.getElementById('detailTestAudio').hidden, answerHidden: document.getElementById('detailAnswer').hidden, scrollWidth: document.documentElement.scrollWidth, width: innerWidth };
  })()`);
  assert.equal(mobileSelfTest.audioVisible, true);
  assert.equal(mobileSelfTest.answerHidden, true);
  assert.ok(mobileSelfTest.scrollWidth <= mobileSelfTest.width);
  const mobileSelfTestShot = path.join(os.tmpdir(), 'kana-mobile-self-test-cdp.png');
  await screenshot(mobileSelfTestShot);
  await viewport(320, 700, true);
  await send('Page.navigate', { url: pageUrl });
  await waitForApp();
  const narrow = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })');
  assert.ok(narrow.scrollWidth <= narrow.width, `narrow mobile overflow: ${narrow.scrollWidth} > ${narrow.width}`);
  await viewport(1365, 900, false);
  const courseIntro = await evaluate(`(() => {
    document.getElementById('heroCourse').click();
    return { title: document.querySelector('.course-panel-head h3').textContent, lessons: document.querySelectorAll('.course-list-item').length, first: document.querySelector('.course-list-item').dataset.courseSelect, visible: !document.getElementById('courseView').hidden, headerPath: !document.getElementById('headerPath').hidden, modeHidden: document.getElementById('modeSwitch').hidden, width: document.documentElement.scrollWidth };
  })()`);
  assert.equal(courseIntro.title, '五十音，从这里开始。');
  assert.equal(courseIntro.lessons, 15);
  assert.equal(courseIntro.first, '00');
  assert.equal(courseIntro.visible, true);
  assert.equal(courseIntro.headerPath, true);
  assert.equal(courseIntro.modeHidden, true);
  assert.ok(courseIntro.width <= 1365);
  await evaluate(`document.getElementById('coursePanel').scrollIntoView({block:'start',behavior:'instant'})`);
  const courseFoundationShot = path.join(os.tmpdir(), 'kana-course-foundation-cdp.png');
  await screenshot(courseFoundationShot);
  const foundationNavigation = await evaluate(`(() => {
    document.querySelector('[data-course-foundation="hiragana"]').click();
    const hiragana = !document.getElementById('learnView').hidden && document.querySelector('[data-mode="hiragana"]').classList.contains('active');
    document.getElementById('heroCourse').click();
    document.querySelector('[data-course-foundation="katakana"]').click();
    const katakana = !document.getElementById('learnView').hidden && document.querySelector('[data-mode="katakana"]').classList.contains('active');
    document.getElementById('heroCourse').click();
    document.querySelector('[data-course-foundation="practice"]').click();
    const practice = !document.getElementById('practiceView').hidden && document.getElementById('practicePool').value === 'all';
    document.getElementById('heroCourse').click();
    document.querySelector('[data-course-select="01"]').click();
    return {hiragana, katakana, practice, nextTitle: document.querySelector('.course-panel-head h3').textContent};
  })()`);
  assert.deepEqual(foundationNavigation, {hiragana:true, katakana:true, practice:true, nextTitle:'介绍自己'});
  const speedControl = await evaluate(`(() => {
    const normalButton = document.querySelector('#courseView [data-audio-speed="normal"]');
    const slowButton = document.querySelector('#courseView [data-audio-speed="slow"]');
    const initial = JSON.parse(localStorage.getItem('kana-studio-progress-v1')).audioSpeed;
    slowButton.click();
    const slow = JSON.parse(localStorage.getItem('kana-studio-progress-v1')).audioSpeed;
    normalButton.click();
    const normal = JSON.parse(localStorage.getItem('kana-studio-progress-v1')).audioSpeed;
    return {initial, slow, normal};
  })()`);
  assert.deepEqual(speedControl, {initial: 'normal', slow: 'slow', normal: 'normal'});
  const sentencePlayCount = await evaluate(`(async () => {
    const originalPlay = HTMLMediaElement.prototype.play;
    let count = 0; let clip;
    HTMLMediaElement.prototype.play = function () { count += 1; clip = this; return Promise.resolve(); };
    document.querySelector('[data-course-audio="example0"]').click();
    clip.dispatchEvent(new Event('ended'));
    await new Promise(resolve => setTimeout(resolve, 480));
    HTMLMediaElement.prototype.play = originalPlay;
    return count;
  })()`);
  assert.equal(sentencePlayCount, 1, 'course sentences play once at the selected speed');
  await evaluate('document.getElementById("courseView").scrollIntoView({block:"start",behavior:"instant"})');
  const courseDesktopShot = path.join(os.tmpdir(), 'kana-course-desktop-cdp.png');
  await screenshot(courseDesktopShot);
  const courseRun = await evaluate(`(() => {
    document.querySelector('[data-course-start="full"]').click();
    const lesson = window.CourseData.lessons[0];
    const originalPlay = HTMLMediaElement.prototype.play;
    let played = '';
    HTMLMediaElement.prototype.play = function () { played = this.src; return Promise.resolve(); };
    for (const question of lesson.questions) {
      const promptAudio = document.querySelector('[data-course-audio="question"], [data-course-audio="listen"]');
      if (['meaning', 'read', 'listen'].includes(question.type)) {
        if (!promptAudio) throw new Error('Missing question audio button: ' + question.id);
        promptAudio.click();
        if (!new URL(played).pathname.endsWith('/' + question.audio)) throw new Error('Wrong prompt audio: ' + question.id);
      } else if (promptAudio) throw new Error('Answer revealed by audio before submission: ' + question.id);
      if (question.id === '01-q1') document.getElementById('courseView').dispatchEvent(new KeyboardEvent('keydown', {key:'2', bubbles:true}));
      else if (question.type === 'meaning') document.querySelector('[data-course-choice="' + question.options.indexOf(question.answer) + '"]').click();
      else if (question.type === 'particle' || question.type === 'listen') {
        const index = question.options.indexOf(question.answer);
        document.querySelector('[data-course-choice="' + index + '"]').click();
      } else if (question.type === 'order') {
        let remaining = question.answer.replace(/\\s/g, '');
        const available = question.tiles.map((_, index) => index);
        while (remaining) {
          const index = available.find(candidate => remaining.startsWith(question.tiles[candidate]));
          if (index === undefined) throw new Error('Order fixture cannot be assembled');
          document.querySelector('[data-course-tile="' + index + '"]').click();
          remaining = remaining.slice(question.tiles[index].length);
          available.splice(available.indexOf(index), 1);
        }
        document.querySelector('[data-course-order-submit]').click();
      } else if (question.type === 'read') {
        document.getElementById('courseReadInput').value = question.answers[0];
        document.getElementById('courseReadForm').requestSubmit();
      }
      if (['particle', 'order'].includes(question.type)) {
        document.querySelector('.course-answer [data-course-audio="question"]').click();
        if (!new URL(played).pathname.endsWith('/' + question.audio)) throw new Error('Wrong answer audio: ' + question.id);
      }
      document.querySelector('[data-course-next]').click();
    }
    HTMLMediaElement.prototype.play = originalPlay;
    const state = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
    const mastered = window.CourseCore.getStatus(state, '01');
    const reviewCount = document.querySelector('[data-course-start="review"]')?.textContent;
    document.querySelector('[data-course-master]').click();
    const retired = window.CourseCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), '01');
    document.querySelector('[data-course-master]').click();
    const restored = window.CourseCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), '01');
    return { mastered, reviewCount, retired, restored, runCount: state.courseRecords['01'].runs.length };
  })()`);
  assert.equal(courseRun.mastered, 'mastered');
  assert.match(courseRun.reviewCount, /1 道错题/);
  assert.deepEqual({ retired: courseRun.retired, restored: courseRun.restored, runCount: courseRun.runCount }, { retired: 'retired', restored: 'mastered', runCount: 1 });
  const courseBackup = await evaluate(`(async () => {
    URL.createObjectURL = blob => { window.__exportedBlob = blob; return 'blob:course-smoke'; };
    HTMLAnchorElement.prototype.click = function () {};
    window.confirm = () => true;
    document.getElementById('exportProgress').click();
    const snapshot = JSON.parse(await window.__exportedBlob.text());
    const before = window.CourseCore.getStatus(snapshot, '01');
    document.getElementById('resetProgress').click();
    const reset = window.CourseCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), '01');
    const file = new File([JSON.stringify(snapshot)], 'course-progress.json', {type:'application/json'});
    const transfer = new DataTransfer(); transfer.items.add(file);
    const input = document.getElementById('importProgress'); input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    const restored = window.CourseCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), '01');
    return { before, reset, restored };
  })()`);
  assert.deepEqual(courseBackup, { before: 'mastered', reset: 'unseen', restored: 'mastered' });
  const courseAudio = await evaluate(`new Promise((resolve, reject) => {
    const audio = new Audio('audio/course-01-listen.mp3');
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = () => reject(new Error('course MP3 could not load'));
    audio.load();
  })`);
  assert.ok(courseAudio > 0.5);
  const addedCourses = await evaluate(`(async () => {
    const completed = [];
    for (const lesson of window.CourseData.lessons.slice(8)) {
      document.querySelector('[data-course-select="' + lesson.id + '"]').click();
      for (const item of [...lesson.examples, ...lesson.vocabulary, ...lesson.questions]) {
        await new Promise((resolve, reject) => {
          const audio = new Audio(item.audio);
          audio.onloadedmetadata = () => audio.duration > 0.2 ? resolve() : reject(new Error('Empty audio: ' + item.audio));
          audio.onerror = () => reject(new Error('Missing audio: ' + item.audio));
          audio.load();
        });
      }
      document.querySelector('[data-course-start="full"]').click();
      for (const question of lesson.questions) {
        if (question.type === 'listen') {
          if (document.getElementById('coursePanel').textContent.includes(question.kana)) throw new Error('Listening answer revealed before submission');
        }
        if (question.options) {
          document.querySelector('[data-course-choice="' + question.options.indexOf(question.answer) + '"]').click();
        } else if (question.type === 'order') {
          let remaining = (question.acceptedAnswers?.[0] || question.answer).replace(/\\s/g, '');
          const available = question.tiles.map((_, index) => index);
          while (remaining) {
            const index = available.find(candidate => remaining.startsWith(question.tiles[candidate]));
            if (index === undefined) throw new Error('Cannot assemble ' + question.id);
            document.getElementById('courseView').dispatchEvent(new KeyboardEvent('keydown', {key:String(index + 1), bubbles:true}));
            remaining = remaining.slice(question.tiles[index].length);
            available.splice(available.indexOf(index), 1);
          }
          document.querySelector('[data-course-order-submit]').click();
        } else {
          document.getElementById('courseReadInput').value = question.answers.at(-1);
          document.getElementById('courseReadForm').requestSubmit();
        }
        if (!document.querySelector('.course-answer.correct')) throw new Error('Correct answer rejected: ' + question.id);
        document.querySelector('[data-course-next]').click();
      }
      const state = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
      completed.push({id:lesson.id, status:window.CourseCore.getStatus(state, lesson.id)});
    }
    const finalNext = !!document.querySelector('[data-course-next-lesson]');
    const roadmapHidden = document.getElementById('courseRoadmap').closest('section').hidden;
    return {completed, finalNext, roadmapHidden};
  })()`);
  assert.deepEqual(addedCourses.completed, ['09', '10', '11', '12', '13', '14'].map(id => ({id, status:'mastered'})));
  assert.equal(addedCourses.finalNext, false);
  assert.equal(addedCourses.roadmapHidden, true);
  await send('Page.reload');
  await waitForApp();
  assert.equal(await evaluate(`window.CourseCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), '14')`), 'mastered');
  await evaluate(`document.getElementById('heroCourse').click(); document.querySelector('[data-course-select="12"]').click(); document.getElementById('coursePanel').scrollIntoView({block:'start',behavior:'instant'})`);
  await screenshot(courseDesktopShot);
  await viewport(390, 844, true);
  const mobileRoute = await evaluate(`(() => {
    document.getElementById('heroCourse').click();
    document.getElementById('courseView').scrollIntoView({block:'start',behavior:'instant'});
    const list = document.getElementById('courseList');
    return {first:list.querySelector('button').dataset.courseSelect, selected:list.querySelector('[aria-current="true"]').dataset.courseSelect, scrollable:list.scrollWidth > list.clientWidth, pageWidth:document.documentElement.scrollWidth, display:getComputedStyle(list).display, clientWidth:list.clientWidth, scrollWidth:list.scrollWidth, itemWidth:list.firstElementChild.getBoundingClientRect().width};
  })()`);
  assert.equal(mobileRoute.first, '00');
  assert.equal(mobileRoute.selected, '00');
  assert.equal(mobileRoute.scrollable, true, JSON.stringify(mobileRoute));
  assert.equal(mobileRoute.pageWidth, 390);
  const courseFoundationMobileListShot = path.join(os.tmpdir(), 'kana-course-foundation-mobile-list-cdp.png');
  await screenshot(courseFoundationMobileListShot);
  await evaluate(`document.getElementById('coursePanel').scrollIntoView({block:'start',behavior:'instant'})`);
  const courseFoundationMobileShot = path.join(os.tmpdir(), 'kana-course-foundation-mobile-cdp.png');
  await screenshot(courseFoundationMobileShot);
  await evaluate(`document.getElementById('heroCourse').click(); document.querySelector('[data-course-select="13"]').click(); document.getElementById('coursePanel').scrollIntoView({block:'start',behavior:'instant'})`);
  const courseMobile = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector(".course-panel-head h3").textContent })');
  assert.deepEqual(courseMobile, { width: 390, scrollWidth: 390, title: '这里可以拍照吗' });
  const courseMobileShot = path.join(os.tmpdir(), 'kana-course-mobile-cdp.png');
  await screenshot(courseMobileShot);
  await viewport(1365, 900, false);
  const vocabIntro = await evaluate(`(() => {
    document.querySelector('[data-course-select="02"]').click();
    document.querySelector('[data-course-vocab]').click();
    const originalPlay = HTMLMediaElement.prototype.play;
    let audio = '';
    HTMLMediaElement.prototype.play = function () { audio = this.src; return Promise.resolve(); };
    document.querySelector('[data-vocab-audio="ほん"]').click();
    HTMLMediaElement.prototype.play = originalPlay;
    return {visible:!document.getElementById('vocabView').hidden, chapter:document.getElementById('vocabChapter').value, chapters:document.getElementById('vocabChapter').options.length, cards:document.querySelectorAll('.vocab-card').length, audio:new URL(audio).pathname.endsWith('/audio/course-02-v1.mp3')};
  })()`);
  assert.deepEqual(vocabIntro, {visible:true, chapter:'02', chapters:14, cards:17, audio:true});
  await evaluate(`document.getElementById('vocabView').scrollIntoView({block:'start',behavior:'instant'})`);
  const vocabDesktopShot = path.join(os.tmpdir(), 'kana-vocab-desktop-cdp.png');
  await screenshot(vocabDesktopShot);
  await viewport(390, 844, true);
  const vocabMobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:document.querySelectorAll('.vocab-card').length})`);
  assert.deepEqual(vocabMobile, {width:390,scrollWidth:390,cards:17});
  const vocabMobileShot = path.join(os.tmpdir(), 'kana-vocab-mobile-cdp.png');
  await screenshot(vocabMobileShot);
  await evaluate(`document.getElementById('vocabGrid').scrollIntoView({block:'start',behavior:'instant'})`);
  const vocabMobileCardsShot = path.join(os.tmpdir(), 'kana-vocab-mobile-cards-cdp.png');
  await screenshot(vocabMobileCardsShot);
  const vocabRun = await evaluate(`(() => {
    document.querySelector('[data-vocab-master="ほん"]').click();
    const picker = document.getElementById('vocabChapter');
    picker.value = '05'; picker.dispatchEvent(new Event('change', {bubbles:true}));
    const shared = document.querySelector('[data-vocab-master="ほん"]').getAttribute('aria-pressed') === 'true';
    document.getElementById('vocabStart').click();
    let answered = 0;
    while (!document.querySelector('.vocab-practice-done') && answered < 40) {
      const panel = document.getElementById('vocabPractice');
      const kana = panel.querySelector('.vocab-practice-question strong').textContent;
      if (kana === 'ほん') throw new Error('Mastered word was repeated');
      const word = window.VocabCore.byChapter.get('05').words.find(entry => entry.kana === kana);
      if (panel.querySelector('#vocabAnswer')) {
        panel.querySelector('#vocabAnswer').value = word.romaji;
        panel.querySelector('#vocabAnswerForm').requestSubmit();
      } else {
        [...panel.querySelectorAll('[data-vocab-choice]')].find(button => button.textContent.includes(word.meaning)).click();
      }
      if (!panel.querySelector('.vocab-feedback.correct')) throw new Error('Vocabulary answer rejected: ' + kana);
      answered++;
      panel.querySelector('[data-vocab-next]').click();
    }
    const saved = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
    return {shared,answered,done:!!document.querySelector('.vocab-practice-done'),mastered:saved.vocabRecords['ほん'].manualMastered,uniqueRecords:Object.keys(saved.vocabRecords).length,courseSaved:window.CourseCore.getStatus(saved,'14')};
  })()`);
  assert.deepEqual(vocabRun, {shared:true,answered:32,done:true,mastered:true,uniqueRecords:17,courseSaved:'mastered'});
  await evaluate(`document.querySelector('[data-vocab-restart]').click(); document.getElementById('vocabPractice').scrollIntoView({block:'start',behavior:'instant'})`);
  const vocabMobilePracticeShot = path.join(os.tmpdir(), 'kana-vocab-mobile-practice-cdp.png');
  await screenshot(vocabMobilePracticeShot);
  await evaluate(`document.querySelector('[data-vocab-close]').click()`);
  const vocabBackup = await evaluate(`(async () => {
    URL.createObjectURL = blob => { window.__vocabBlob = blob; return 'blob:vocab-smoke'; };
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('exportProgress').click();
    const snapshot = JSON.parse(await window.__vocabBlob.text());
    window.confirm = () => true;
    document.getElementById('resetProgress').click();
    const cleared = Object.keys(JSON.parse(localStorage.getItem('kana-studio-progress-v1')).vocabRecords).length;
    const file = new File([JSON.stringify(snapshot)], 'vocab-progress.json', {type:'application/json'});
    const transfer = new DataTransfer(); transfer.items.add(file);
    const input = document.getElementById('importProgress'); input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    const restored = JSON.parse(localStorage.getItem('kana-studio-progress-v1'));
    return {cleared,mastered:restored.vocabRecords['ほん'].manualMastered,course:window.CourseCore.getStatus(restored,'14')};
  })()`);
  assert.deepEqual(vocabBackup, {cleared:0,mastered:true,course:'mastered'});
  const courseVocabCount = await evaluate(`(() => {
    document.querySelector('[data-view="course"]').click();
    document.querySelector('[data-course-select="05"]').click();
    return document.querySelector('.course-vocab h4').textContent;
  })()`);
  assert.match(courseVocabCount, /已学会 1 个/);
  await viewport(320, 700, true);
  const narrowVocab = await evaluate(`(() => { document.querySelector('[data-view="vocab"]').click(); return document.documentElement.scrollWidth; })()`);
  assert.equal(narrowVocab, 320, 'vocabulary cards fit narrow phones');
  await evaluate(`document.querySelector('[data-view="course"]').click()`);
  await evaluate(`document.querySelector('[data-course-select="10"]').click(); document.querySelector('[data-course-start="full"]').click()`);
  assert.equal(await evaluate('document.documentElement.scrollWidth'), 320, 'new course fits narrow phones');
  const manualKana = await evaluate(`(() => {
    document.querySelector('[data-view="learn"]').click();
    document.querySelector('[data-mode="hiragana"]').click();
    document.querySelector('[data-group="base"]').click();
    document.querySelector('.card-open').click();
    const id = 'hiragana:base:a';
    document.getElementById('detailMaster').click();
    const retired = window.KanaCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), id);
    document.getElementById('detailMaster').click();
    const restored = window.KanaCore.getStatus(JSON.parse(localStorage.getItem('kana-studio-progress-v1')), id);
    return { retired, restored };
  })()`);
  assert.deepEqual(manualKana, { retired: 'retired', restored: 'learning' });
  console.log(JSON.stringify({ passed: true, desktopShot, journeyShot, mobileJourneyShot, mobileShot, mobileChartShot, mobilePracticeShot, mobileSelfTestShot, courseFoundationShot, courseFoundationMobileListShot, courseFoundationMobileShot, courseDesktopShot, courseMobileShot, vocabDesktopShot, vocabMobileShot, vocabMobileCardsShot, vocabMobilePracticeShot, mobile, mobileJourney, mobilePractice, mobileSelfTest, narrow, courseRun, courseBackup, mobileRoute, courseMobile, vocabRun, vocabBackup, manualKana }));
  ws.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  browser.kill();
  await sleep(1000);
  const temp = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(temp)) {
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 }); }
    catch (error) { if (!['EPERM', 'EBUSY'].includes(error.code)) throw error; }
  }
});
