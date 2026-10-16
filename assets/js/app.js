import { uiFor } from './i18n.js';
import { settings, saveSettings, wordKey, getProgress, record, resetLanguage, MAX_BOX } from './store.js';
import { speak, unlock, speechSupported, hasVoice } from './speech.js';

const MODES = ['flash', 'quiz', 'reverse', 'listen', 'type', 'match'];
const MODE_ICONS = { flash: '🃏', quiz: '🔤', reverse: '🔁', listen: '🎧', type: '⌨️', match: '🧩' };
const COUNTS = [10, 20, 30, 0]; // 0 = all
const MASTERED_BOX = 3;
const MATCH_PAIRS = 6;

const screen = document.getElementById('screen');
let index = null; // data/languages.json
const vocabCache = new Map();
let t = uiFor(settings.target);
let audioUnlocked = false;

// ---------- helpers ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nameOf(obj) {
  return (obj && (obj[settings.target] || obj.th || obj.en)) || '';
}

// replaceChildren() would print null/false as text, so drop them first.
function fill(el, ...nodes) {
  el.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
}

function render(...nodes) {
  fill(screen, ...nodes);
  window.scrollTo(0, 0);
}

function ensureAudio() {
  if (!audioUnlocked) {
    unlock();
    audioUnlocked = true;
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function loadLang(code) {
  if (vocabCache.has(code)) return vocabCache.get(code);
  const meta = index.learn.find((l) => l.code === code);
  const data = await fetchJSON(`data/${meta.file}`);
  vocabCache.set(code, data);
  return data;
}

function targetsFor(vocab) {
  const sample = vocab.sets[0]?.words[0]?.tr || {};
  return index.translate.filter((x) => x.code !== vocab.code && sample[x.code]);
}

function itemsFor(vocab, setIds) {
  const items = [];
  for (const set of vocab.sets) {
    if (!setIds.includes(set.id)) continue;
    for (const w of set.words) {
      const answer = w.tr[settings.target];
      if (!answer) continue;
      items.push({
        key: wordKey(vocab.code, set.id, w.term),
        term: w.term,
        roman: w.roman || '',
        answer,
        note: w.note ? w.note[settings.target] || w.note.th || '' : '',
        setId: set.id,
      });
    }
  }
  return items;
}

// Weighted sampling without replacement: words in low boxes and unseen words come up more often.
function pickItems(items, count) {
  const n = count > 0 ? Math.min(count, items.length) : items.length;
  return items
    .map((it) => {
      const p = getProgress(it.key);
      const w = (MAX_BOX - p.b + 1) * (p.t ? 1 : 1.5);
      return { it, k: Math.pow(Math.random(), 1 / w) };
    })
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.it);
}

// Distractors must differ from the correct item in both the term and the answer,
// so homonyms (e.g. 눈 eye / 눈 snow) and shared meanings never produce two right options.
function distractors(item, pool, n = 3) {
  const ok = (x) => x.term !== item.term && x.answer !== item.answer;
  const out = [];
  const seenT = new Set([item.term]);
  const seenA = new Set([item.answer]);
  const take = (list) => {
    for (const x of shuffle(list)) {
      if (out.length >= n) return;
      if (!ok(x) || seenT.has(x.term) || seenA.has(x.answer)) continue;
      out.push(x);
      seenT.add(x.term);
      seenA.add(x.answer);
    }
  };
  take(pool.filter((x) => x.setId === item.setId)); // same set first: harder
  take(pool);
  return out;
}

function langTag() {
  return vocabCache.get(settings.lang)?.speech || settings.lang;
}

function say(text) {
  speak(text, langTag());
}

function speakerBtn(text, big = false) {
  if (!speechSupported) return null;
  return h('button', {
    class: big ? 'speaker big' : 'speaker',
    type: 'button',
    'aria-label': t.tapToListen,
    onclick: (e) => {
      e.stopPropagation();
      ensureAudio();
      say(text);
    },
  }, '🔊');
}

function termBlock(item, { size = 'xl', roman = settings.showRoman } = {}) {
  return h('div', { class: `term term-${size}`, lang: settings.lang },
    h('span', { class: 'term-text' }, item.term),
    roman && item.roman ? h('span', { class: 'roman' }, item.roman) : null,
  );
}

// ---------- setup screen ----------

async function renderSetup() {
  t = uiFor(settings.target);
  document.documentElement.lang = settings.target;
  document.title = t.appName;
  document.querySelector('.brand-name').textContent = t.appName;
  document.querySelector('.brand-tag').textContent = t.tagline;

  let vocab;
  try {
    vocab = await loadLang(settings.lang);
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, t.loadError, h('button', { class: 'btn', onclick: renderSetup }, '↻')));
    return;
  }

  const targets = targetsFor(vocab);
  if (!targets.some((x) => x.code === settings.target)) {
    settings.target = targets[0]?.code || 'th';
    saveSettings();
    return renderSetup();
  }

  const chosen = new Set(settings.sets[settings.lang] || vocab.sets.slice(0, 2).map((s) => s.id));
  const persistSets = () => {
    settings.sets[settings.lang] = [...chosen];
    saveSettings();
  };

  // 1. languages
  const langCards = index.learn.map((l) =>
    h('button', {
      type: 'button',
      class: `lang-card${l.code === settings.lang ? ' active' : ''}`,
      'aria-pressed': String(l.code === settings.lang),
      onclick: () => {
        if (l.code === settings.lang) return;
        settings.lang = l.code;
        saveSettings();
        renderSetup();
      },
    },
    h('span', { class: 'flag' }, l.flag),
    h('span', { class: 'lang-name' }, nameOf(l.name)),
    h('span', { class: 'lang-native' }, l.nativeName)),
  );

  const targetSelect = h('select', {
    id: 'target',
    onchange: (e) => {
      settings.target = e.target.value;
      saveSettings();
      renderSetup();
    },
  }, targets.map((x) => h('option', { value: x.code, selected: x.code === settings.target }, `${x.nativeName}`)));

  // 2. sets
  const setGrid = h('div', { class: 'set-grid' });
  const startBtn = h('button', { class: 'btn primary big', type: 'button' }, `▶ ${t.start}`);

  const refreshStart = () => {
    startBtn.disabled = chosen.size === 0;
  };

  for (const set of vocab.sets) {
    const total = set.words.filter((w) => w.tr[settings.target]).length;
    const mastered = set.words.filter((w) => getProgress(wordKey(vocab.code, set.id, w.term)).b >= MASTERED_BOX).length;
    const pct = total ? Math.round((mastered / total) * 100) : 0;
    const cb = h('input', {
      type: 'checkbox',
      checked: chosen.has(set.id),
      onchange: (e) => {
        if (e.target.checked) chosen.add(set.id);
        else chosen.delete(set.id);
        persistSets();
        refreshStart();
      },
    });
    setGrid.append(
      h('label', { class: 'set-card' },
        cb,
        h('span', { class: 'set-icon' }, set.icon),
        h('span', { class: 'set-body' },
          h('span', { class: 'set-name' }, nameOf(set.name)),
          h('span', { class: 'set-meta' }, `${total} ${t.words} · ${t.mastered} ${mastered}`),
          h('span', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${pct}%` })),
        ),
      ),
    );
  }

  const setAll = (on) => {
    chosen.clear();
    if (on) vocab.sets.forEach((s) => chosen.add(s.id));
    setGrid.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.checked = on));
    persistSets();
    refreshStart();
  };

  // 3. modes
  const modeGrid = h('div', { class: 'mode-grid' });
  const voiceOk = speechSupported && hasVoice(langTag());
  for (const m of MODES) {
    const [title, desc] = t.modes[m];
    const disabled = m === 'listen' && !speechSupported;
    modeGrid.append(
      h('label', { class: `mode-card${disabled ? ' disabled' : ''}` },
        h('input', {
          type: 'radio',
          name: 'mode',
          value: m,
          disabled,
          checked: settings.mode === m,
          onchange: () => {
            settings.mode = m;
            saveSettings();
          },
        }),
        h('span', { class: 'mode-icon' }, MODE_ICONS[m]),
        h('span', { class: 'mode-body' }, h('span', { class: 'mode-name' }, title), h('span', { class: 'mode-desc' }, desc)),
      ),
    );
  }

  // 4. options
  const countSeg = h('div', { class: 'segmented', role: 'radiogroup' },
    COUNTS.map((c) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'count',
          value: c,
          checked: settings.count === c,
          onchange: () => {
            settings.count = c;
            saveSettings();
          },
        }),
        h('span', {}, c === 0 ? t.all : String(c)),
      ),
    ),
  );

  const toggle = (key, label) =>
    h('label', { class: 'toggle' },
      h('input', {
        type: 'checkbox',
        checked: settings[key],
        onchange: (e) => {
          settings[key] = e.target.checked;
          saveSettings();
        },
      }),
      h('span', { class: 'switch' }),
      h('span', {}, label),
    );

  const hasRoman = vocab.sets.some((s) => s.words.some((w) => w.roman));

  startBtn.addEventListener('click', () => {
    ensureAudio();
    const items = itemsFor(vocab, [...chosen]);
    if (!items.length) return alert(t.pickSet);
    if (settings.mode !== 'flash' && items.length < 4) return alert(t.notEnough);
    startGame(pickItems(items, settings.count), items);
  });
  refreshStart();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  render(
    h('section', { class: 'card' },
      h('h2', {}, t.stepLang),
      h('div', { class: 'lang-grid' }, langCards),
      h('div', { class: 'row' }, h('label', { for: 'target', class: 'row-label' }, t.stepTarget), targetSelect),
    ),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, t.stepSets),
        h('div', { class: 'chips' },
          h('button', { class: 'chip', type: 'button', onclick: () => setAll(true) }, t.selectAll),
          h('button', { class: 'chip', type: 'button', onclick: () => setAll(false) }, t.selectNone),
        ),
      ),
      setGrid,
    ),
    h('section', { class: 'card' }, h('h2', {}, t.stepMode), modeGrid),
    h('section', { class: 'card' },
      h('h2', {}, t.stepOptions),
      h('div', { class: 'row' }, h('span', { class: 'row-label' }, t.questions), countSeg),
      hasRoman ? toggle('showRoman', t.showRoman) : null,
      speechSupported ? toggle('autoSpeak', t.autoSpeak) : null,
      speechSupported && !voiceOk ? h('p', { class: 'hint warn' }, t.noVoice) : null,
      !speechSupported ? h('p', { class: 'hint warn' }, t.noSpeech) : null,
    ),
    h('div', { class: 'start-bar' }, startBtn),
    isIOS && !standalone ? h('p', { class: 'hint center' }, `📲 ${t.installHint}`) : null,
    h('footer', { class: 'foot' },
      h('p', {}, t.licenseNote),
      h('button', {
        class: 'link-btn',
        type: 'button',
        onclick: () => {
          if (confirm(t.resetConfirm)) {
            resetLanguage(settings.lang);
            renderSetup();
          }
        },
      }, t.resetProgress),
    ),
  );
}

// ---------- game shell ----------

function startGame(items, pool) {
  const session = {
    mode: settings.mode,
    items,
    pool,
    i: 0,
    correct: 0,
    wrong: [],
    startedAt: Date.now(),
  };
  if (session.mode === 'match') playMatch(session);
  else playNext(session);
}

function topBar(session, label) {
  const total = session.items.length;
  const pct = Math.round((session.i / total) * 100);
  return h('div', { class: 'game-top' },
    h('button', { class: 'btn ghost', type: 'button', onclick: () => renderSetup() }, `✕ ${t.quit}`),
    h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${pct}%` })),
    h('span', { class: 'counter' }, label ?? `${Math.min(session.i + 1, total)}/${total}`),
  );
}

function grade(session, item, ok) {
  record(item.key, ok);
  if (ok) session.correct++;
  else if (!session.wrong.includes(item)) session.wrong.push(item);
}

function playNext(session) {
  if (session.i >= session.items.length) return showResults(session);
  const item = session.items[session.i];
  const advance = () => {
    session.i++;
    playNext(session);
  };
  const view = { flash: flashView, quiz: choiceView, reverse: choiceView, listen: choiceView, type: typeView }[session.mode];
  view(session, item, advance);
}

let keyHandler = null;
function onKeys(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

function noteEl(item) {
  return item.note ? h('p', { class: 'note' }, `💡 ${item.note}`) : null;
}

// ---------- flashcards ----------

function flashView(session, item, advance) {
  let flipped = false;
  const back = h('div', { class: 'face back' },
    h('div', { class: 'answer-big' }, item.answer),
    noteEl(item),
  );
  const front = h('div', { class: 'face front' },
    termBlock(item),
    h('span', { class: 'flip-hint' }, t.tapToFlip),
  );
  const actions = h('div', { class: 'actions two hidden' },
    h('button', { class: 'btn bad', type: 'button', onclick: () => done(false) }, `😅 ${t.forgot}`),
    h('button', { class: 'btn good', type: 'button', onclick: () => done(true) }, `😊 ${t.remembered}`),
  );
  const card = h('div', { class: 'flashcard', role: 'button', tabindex: '0', onclick: () => flip() },
    h('div', { class: 'flash-inner' }, front, back),
    h('div', { class: 'flash-speaker' }, speakerBtn(item.term)),
  );

  function flip() {
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    actions.classList.remove('hidden');
  }
  function done(ok) {
    grade(session, item, ok);
    advance();
  }

  render(h('div', { class: 'game' }, topBar(session), card, actions));
  onKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) done(false);
    else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) done(true);
  });
  if (settings.autoSpeak) say(item.term);
}

// ---------- multiple choice (quiz / reverse / listen) ----------

function choiceView(session, item, advance) {
  const mode = session.mode;
  const options = shuffle([item, ...distractors(item, session.pool)]);
  let answered = false;

  let prompt;
  if (mode === 'quiz') prompt = h('div', { class: 'prompt' }, termBlock(item), speakerBtn(item.term));
  else if (mode === 'reverse') prompt = h('div', { class: 'prompt' }, h('div', { class: 'answer-big' }, item.answer));
  else prompt = h('div', { class: 'prompt listen' }, speakerBtn(item.term, true), h('span', { class: 'flip-hint' }, t.tapToListen));

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const nextBtn = h('button', { class: 'btn primary hidden', type: 'button', onclick: () => advance() }, `${t.next} →`);

  const buttons = options.map((opt, idx) => {
    const label = mode === 'reverse'
      ? h('span', { class: 'opt-term', lang: settings.lang }, opt.term, settings.showRoman && opt.roman ? h('small', {}, opt.roman) : null)
      : h('span', {}, opt.answer);
    return h('button', {
      class: 'option',
      type: 'button',
      onclick: () => choose(opt, idx),
    }, h('span', { class: 'opt-key' }, idx + 1), label);
  });

  function choose(opt, idx) {
    if (answered) return;
    answered = true;
    const ok = opt === item;
    grade(session, item, ok);
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (options[i] === item) b.classList.add('right');
      else if (i === idx) b.classList.add('wrong');
    });
    fill(feedback,
      h('strong', { class: ok ? 'ok' : 'ng' }, ok ? t.correct : t.wrong),
      mode !== 'quiz' || !ok ? h('div', { class: 'reveal' }, termBlock(item, { size: 'md', roman: true }), ' = ', item.answer) : null,
      noteEl(item),
    );
    if (mode !== 'quiz' || settings.autoSpeak) say(item.term);
    if (ok) setTimeout(() => advance(), item.note ? 1600 : 900);
    else nextBtn.classList.remove('hidden');
  }

  render(h('div', { class: 'game' },
    topBar(session),
    prompt,
    h('div', { class: 'options' }, buttons),
    feedback,
    h('div', { class: 'actions' }, nextBtn),
  ));

  onKeys((e) => {
    const n = Number(e.key);
    if (!answered && n >= 1 && n <= options.length) choose(options[n - 1], n - 1);
    else if (answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); advance(); }
  });
  if (mode === 'listen' || (mode === 'quiz' && settings.autoSpeak)) say(item.term);
}

// ---------- typing ----------

function normalize(s) {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s?!.,'’"\-–~]/g, '');
}

function typeView(session, item, advance) {
  let answered = false;
  const input = h('input', {
    class: 'type-input',
    type: 'text',
    lang: settings.lang,
    placeholder: t.typeHere,
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const checkBtn = h('button', { class: 'btn primary', type: 'submit' }, t.check);
  const skipBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => check(true) }, t.dontKnow);

  function check(skip = false) {
    if (answered) return advance();
    const v = normalize(input.value);
    if (!v && !skip) return input.focus();
    answered = true;
    const accepted = [item.term, item.roman].filter(Boolean).map(normalize);
    const ok = !skip && accepted.includes(v);
    grade(session, item, ok);
    input.readOnly = true;
    input.classList.add(ok ? 'right' : 'wrong');
    fill(feedback,
      h('strong', { class: ok ? 'ok' : 'ng' }, ok ? t.correct : t.wrong),
      h('div', { class: 'reveal' }, termBlock(item, { size: 'md', roman: true }), speakerBtn(item.term)),
      noteEl(item),
    );
    say(item.term);
    checkBtn.textContent = `${t.next} →`;
    skipBtn.classList.add('hidden');
    checkBtn.focus({ preventScroll: true });
  }

  const form = h('form', {
    class: 'type-form',
    onsubmit: (e) => {
      e.preventDefault();
      check();
    },
  }, input, h('div', { class: 'actions two' }, skipBtn, checkBtn));

  render(h('div', { class: 'game' },
    topBar(session),
    h('div', { class: 'prompt' }, h('div', { class: 'answer-big' }, item.answer)),
    form,
    h('p', { class: 'hint center' }, t.typeHint),
    feedback,
  ));
  onKeys(null);
  // iOS only opens the keyboard on focus during a user gesture; this still
  // focuses the field on iPad with a hardware keyboard.
  input.focus({ preventScroll: true });
}

// ---------- matching ----------

function playMatch(session) {
  const rounds = [];
  for (let i = 0; i < session.items.length; i += MATCH_PAIRS) rounds.push(session.items.slice(i, i + MATCH_PAIRS));
  // the last round needs at least 2 pairs to be a game
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) {
    rounds[rounds.length - 2].push(...rounds.pop());
  }
  let r = 0;
  let doneCount = 0;

  function playRound() {
    if (r >= rounds.length) {
      session.i = session.items.length;
      return showResults(session);
    }
    const pairs = rounds[r];
    const missed = new Set();
    let left = pairs.length;
    let selL = null;
    let selR = null;

    const mk = (item, side) => {
      const b = h('button', {
        class: `tile ${side}`,
        type: 'button',
        lang: side === 'l' ? settings.lang : settings.target,
        onclick: () => pick(b, item, side),
      },
      side === 'l'
        ? [h('span', {}, item.term), settings.showRoman && item.roman ? h('small', {}, item.roman) : null]
        : item.answer);
      return b;
    };
    const lefts = shuffle(pairs).map((it) => mk(it, 'l'));
    const rights = shuffle(pairs).map((it) => mk(it, 'r'));

    function pick(btn, item, side) {
      if (btn.disabled) return;
      if (side === 'l') {
        if (selL) selL.btn.classList.remove('sel');
        selL = { btn, item };
        say(item.term);
      } else {
        if (selR) selR.btn.classList.remove('sel');
        selR = { btn, item };
      }
      btn.classList.add('sel');
      if (!selL || !selR) return;

      const a = selL;
      const b = selR;
      selL = selR = null;
      if (a.item === b.item) {
        [a.btn, b.btn].forEach((x) => {
          x.classList.remove('sel');
          x.classList.add('matched');
          x.disabled = true;
        });
        const ok = !missed.has(a.item);
        grade(session, a.item, ok);
        doneCount++;
        left--;
        bar.replaceWith((bar = topBarMatch()));
        if (left === 0) setTimeout(() => { r++; playRound(); }, 500);
      } else {
        missed.add(a.item);
        [a.btn, b.btn].forEach((x) => {
          x.classList.remove('sel');
          x.classList.add('shake');
          setTimeout(() => x.classList.remove('shake'), 400);
        });
        if (navigator.vibrate) navigator.vibrate(60);
      }
    }

    const topBarMatch = () => {
      session.i = doneCount;
      return topBar(session, `${t.round} ${r + 1}/${rounds.length}`);
    };
    let bar = topBarMatch();
    render(h('div', { class: 'game' },
      bar,
      h('div', { class: 'match-grid' }, h('div', { class: 'match-col' }, lefts), h('div', { class: 'match-col' }, rights)),
    ));
    onKeys(null);
  }
  playRound();
}

// ---------- results ----------

function showResults(session) {
  onKeys(null);
  const total = session.items.length;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  const secs = Math.round((Date.now() - session.startedAt) / 1000);
  const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '📚';

  const wrongList = session.wrong.length
    ? h('ul', { class: 'review-list' }, session.wrong.map((it) =>
        h('li', {},
          h('span', { class: 'rv-term', lang: settings.lang }, it.term, it.roman && settings.showRoman ? h('small', {}, it.roman) : null),
          h('span', { class: 'rv-answer' }, it.answer),
          speakerBtn(it.term),
        )))
    : h('p', { class: 'center' }, t.perfect);

  render(h('div', { class: 'results' },
    h('section', { class: 'card center' },
      h('div', { class: 'big-emoji' }, emoji),
      h('h2', {}, t.resultTitle),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, `${session.correct}/${total}`), h('span', {}, t.score)),
        h('div', { class: 'stat' }, h('b', {}, `${pct}%`), h('span', {}, t.accuracy)),
        h('div', { class: 'stat' }, h('b', {}, `${secs} ${t.sec}`), h('span', {}, t.time)),
      ),
    ),
    h('section', { class: 'card' }, h('h2', {}, t.reviewWrong), wrongList),
    h('div', { class: 'actions stack' },
      session.wrong.length
        ? h('button', { class: 'btn primary big', type: 'button', onclick: () => startGame(shuffle(session.wrong), session.pool) }, `🔁 ${t.practiceWrong}`)
        : null,
      h('button', { class: 'btn big', type: 'button', onclick: () => startGame(pickItems(session.pool, settings.count), session.pool) }, `▶ ${t.playAgain}`),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => renderSetup() }, t.backToSetup),
    ),
  ));
}

// ---------- boot ----------

async function boot() {
  try {
    index = await fetchJSON('data/languages.json');
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, uiFor(settings.target).loadError));
    return;
  }
  if (!index.learn.some((l) => l.code === settings.lang)) settings.lang = index.learn[0].code;
  document.querySelector('.brand').addEventListener('click', () => renderSetup());
  renderSetup();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}

boot();
