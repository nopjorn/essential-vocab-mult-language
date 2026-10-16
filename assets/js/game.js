// Game modes and the results screen.
import { settings, wordKey, getProgress, record, logSession, MAX_BOX } from './store.js';
import { state, h, fill, render, shuffle, say, speakerBtn, termBlock, readingText, answerOf } from './core.js';

export const MODES = ['flash', 'quiz', 'reverse', 'listen', 'type', 'match'];
export const MODE_ICONS = { flash: '🃏', quiz: '🔤', reverse: '🔁', listen: '🎧', type: '⌨️', match: '🧩' };
const MATCH_PAIRS = 6;

let onExit = () => {};
export function setExitHandler(fn) {
  onExit = fn;
}

// ---------- word selection ----------

export function itemsFor(vocab, setIds) {
  const items = [];
  for (const set of vocab.sets) {
    if (!setIds.includes(set.id)) continue;
    for (const w of set.words) {
      items.push({
        key: wordKey(vocab.code, set.id, w.term),
        lang: vocab.code,
        term: w.term,
        reading: w.reading || '',
        roman: w.roman || '',
        answer: answerOf(w),
        note: w.note ? w.note[settings.target] || w.note.th || '' : '',
        setId: set.id,
      });
    }
  }
  return items;
}

// Weighted sampling without replacement: words in low boxes and unseen words come up more often.
export function pickItems(items, count) {
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
  const out = [];
  const seenT = new Set([item.term]);
  const seenA = new Set([item.answer]);
  const take = (list) => {
    for (const x of shuffle(list)) {
      if (out.length >= n) return;
      if (seenT.has(x.term) || seenA.has(x.answer)) continue;
      out.push(x);
      seenT.add(x.term);
      seenA.add(x.answer);
    }
  };
  take(pool.filter((x) => x.setId === item.setId)); // same set first: harder
  take(pool);
  return out;
}

// ---------- shell ----------

export function startGame(items, pool) {
  const session = {
    mode: settings.mode,
    lang: settings.lang,
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
  const t = state.t;
  const total = session.items.length;
  const pct = Math.round((session.i / total) * 100);
  return h('div', { class: 'game-top' },
    h('button', { class: 'btn ghost', type: 'button', onclick: () => { onKeys(null); onExit(); } }, `✕ ${t.quit}`),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(session.i) },
      h('div', { class: 'progress-fill', style: `width:${pct}%` })),
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
export function onKeys(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

function noteEl(item) {
  return item.note ? h('p', { class: 'note' }, `💡 ${item.note}`) : null;
}

function readingSmall(item) {
  const r = settings.showRoman ? readingText(item) : '';
  return r ? h('small', {}, r) : null;
}

// ---------- flashcards ----------

function flashView(session, item, advance) {
  const t = state.t;
  let flipped = false;
  const back = h('div', { class: 'face back' },
    h('div', { class: 'answer-big' }, item.answer),
    termBlock(item, { size: 'md', reading: true }),
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
  const t = state.t;
  const mode = session.mode;
  const options = shuffle([item, ...distractors(item, session.pool)]);
  let answered = false;

  let prompt;
  if (mode === 'quiz') prompt = h('div', { class: 'prompt' }, termBlock(item), speakerBtn(item.term));
  else if (mode === 'reverse') prompt = h('div', { class: 'prompt' }, h('div', { class: 'answer-big' }, item.answer));
  else prompt = h('div', { class: 'prompt listen' }, speakerBtn(item.term, { big: true }), h('span', { class: 'flip-hint' }, t.tapToListen));

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const nextBtn = h('button', { class: 'btn primary hidden', type: 'button', onclick: () => advance() }, `${t.next} →`);

  const buttons = options.map((opt, idx) => {
    const label = mode === 'reverse'
      ? h('span', { class: 'opt-term' }, h('span', { lang: settings.lang }, opt.term), readingSmall(opt))
      : h('span', {}, opt.answer);
    return h('button', { class: 'option', type: 'button', onclick: () => choose(opt, idx) },
      h('span', { class: 'opt-key' }, idx + 1), label);
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
      mode !== 'quiz' || !ok ? h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), ' = ', item.answer) : null,
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

export function normalize(s) {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s?!.,'’"\-–~〜・、。？！「」]/g, '');
}

// Romanization variants: with macrons, without them, and long vowels doubled (ō → ou / oo).
function romanVariants(r) {
  if (!r) return [];
  const plain = r.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const long = r.replace(/ō/g, 'ou').replace(/ū/g, 'uu').replace(/ā/g, 'aa').replace(/ē/g, 'ei').replace(/ī/g, 'ii');
  const longO = r.replace(/ō/g, 'oo');
  return [r, plain, long, longO];
}

export function acceptedAnswers(item) {
  return [...new Set([item.term, item.reading, ...romanVariants(item.roman)].filter(Boolean).map(normalize))];
}

function typeView(session, item, advance) {
  const t = state.t;
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
    const ok = !skip && acceptedAnswers(item).includes(v);
    grade(session, item, ok);
    input.readOnly = true;
    input.classList.add(ok ? 'right' : 'wrong');
    fill(feedback,
      h('strong', { class: ok ? 'ok' : 'ng' }, ok ? t.correct : t.wrong),
      h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), speakerBtn(item.term)),
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
  const t = state.t;
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
    let bar;

    const mk = (item, side) => {
      const b = h('button', {
        class: `tile ${side}`,
        type: 'button',
        lang: side === 'l' ? settings.lang : settings.target,
        onclick: () => pick(b, item, side),
      },
      side === 'l' ? [h('span', {}, item.term), readingSmall(item)] : item.answer);
      return b;
    };
    const lefts = shuffle(pairs).map((it) => mk(it, 'l'));
    const rights = shuffle(pairs).map((it) => mk(it, 'r'));

    const topBarMatch = () => {
      session.i = doneCount;
      return topBar(session, `${t.round} ${r + 1}/${rounds.length}`);
    };

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
        grade(session, a.item, !missed.has(a.item));
        doneCount++;
        left--;
        const nb = topBarMatch();
        bar.replaceWith(nb);
        bar = nb;
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

    bar = topBarMatch();
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
  const t = state.t;
  onKeys(null);
  const total = session.items.length;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  const secs = Math.round((Date.now() - session.startedAt) / 1000);
  const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '📚';
  logSession({ lang: session.lang, mode: session.mode, n: total, c: session.correct, s: secs, t: Date.now() });

  const wrongList = session.wrong.length
    ? h('ul', { class: 'review-list' }, session.wrong.map((it) =>
        h('li', {},
          h('span', { class: 'rv-term' }, h('span', { lang: it.lang }, it.term), readingSmall(it)),
          h('span', { class: 'rv-answer' }, it.answer),
          speakerBtn(it.term, { lang: it.lang }),
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
      h('button', { class: 'btn ghost', type: 'button', onclick: () => onExit() }, t.backToSetup),
    ),
  ));
}
