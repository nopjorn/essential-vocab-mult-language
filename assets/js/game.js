// Game modes and the results screen. Games run full screen (the tab bar is hidden).
import { settings, wordKey, getProgress, record, logSession, getStats, todayAnswers, MAX_BOX, MASTERED_BOX } from './store.js';
import { state, h, fill, render, shuffle, say, speakerBtn, termBlock, readingText, answerOf, groupTitle } from './core.js';
import { icon } from './icons.js';
import { dayTotals, streak } from './progress.js';

export const MODES = ['flash', 'quiz', 'reverse', 'listen', 'type', 'match'];
const MATCH_PAIRS = 6;
const SWIPE_RATIO = 0.28; // fraction of the card width that counts as a decision

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
  // The game replaces whatever page is showing: stop that page's pending async render.
  state.navId++;
  document.body.classList.add('in-game');
  const session = {
    mode: settings.mode,
    lang: settings.lang,
    items,
    pool,
    i: 0,
    correct: 0,
    wrong: [],
    mastered: new Map(), // words that reached the mastered box in this round
    before: todayAnswers(settings.lang),
    startedAt: Date.now(),
  };
  if (session.mode === 'match') playMatch(session);
  else playNext(session);
}

function exitGame() {
  onKeys(null);
  onExit();
}

function topBar(session, label) {
  const t = state.t;
  const total = session.items.length;
  const pct = Math.round((session.i / total) * 100);
  return h('div', { class: 'game-top' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.quit, onclick: exitGame }, icon('close')),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(session.i) },
      h('div', { class: 'progress-fill', style: `width:${pct}%` })),
    h('span', { class: 'counter' }, label ?? `${Math.min(session.i + 1, total)}/${total}`),
  );
}

function grade(session, item, ok) {
  const wasMastered = getProgress(item.key).b >= MASTERED_BOX;
  record(item.key, ok);
  if (!wasMastered && getProgress(item.key).b >= MASTERED_BOX) session.mastered.set(item.key, item);
  else if (!ok) session.mastered.delete(item.key);
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
  return item.note ? h('p', { class: 'note' }, icon('info', { size: 16 }), h('span', {}, item.note)) : null;
}

function readingSmall(item) {
  const r = settings.showRoman ? readingText(item) : '';
  return r ? h('small', {}, r) : null;
}

function verdict(ok) {
  const t = state.t;
  return h('strong', { class: `verdict ${ok ? 'ok' : 'ng'}` }, icon(ok ? 'check' : 'close', { size: 20 }), ok ? t.correct : t.wrong);
}

// ---------- flashcards: tap to flip, swipe right = known, left = not yet ----------

function flashView(session, item, advance) {
  const t = state.t;
  let flipped = false;
  let busy = false;

  const front = h('div', { class: 'face front' }, termBlock(item), h('span', { class: 'flip-hint' }, t.tapToFlip));
  const back = h('div', { class: 'face back' },
    h('div', { class: 'answer-big' }, item.answer),
    termBlock(item, { size: 'md', reading: true }),
    noteEl(item),
  );
  const stampKnow = h('div', { class: 'stamp stamp-know', 'aria-hidden': 'true' }, icon('check', { size: 20 }), t.swipeKnow);
  const stampAgain = h('div', { class: 'stamp stamp-again', 'aria-hidden': 'true' }, icon('close', { size: 20 }), t.swipeAgain);
  const card = h('div', { class: 'flashcard', role: 'button', tabindex: '0', 'aria-label': t.flip },
    h('div', { class: 'flash-inner' }, front, back),
    stampKnow,
    stampAgain,
    h('div', { class: 'flash-speaker' }, speakerBtn(item.term)),
  );
  const hasNext = session.i + 1 < session.items.length;
  const deck = h('div', { class: 'deck' }, hasNext ? h('div', { class: 'deck-next', 'aria-hidden': 'true' }) : null, card);

  function setPos(x, y) {
    card.style.transform = x || y ? `translate(${x}px, ${y * 0.25}px) rotate(${x / 20}deg)` : '';
    const p = Math.min(1, Math.abs(x) / (deck.clientWidth * SWIPE_RATIO));
    stampKnow.style.opacity = x > 0 ? p : 0;
    stampAgain.style.opacity = x < 0 ? p : 0;
  }

  function flip() {
    if (busy) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
  }

  function decide(ok) {
    if (busy) return;
    busy = true;
    const w = deck.clientWidth;
    card.classList.remove('dragging');
    card.classList.add('fly');
    stampKnow.style.opacity = ok ? 1 : 0;
    stampAgain.style.opacity = ok ? 0 : 1;
    card.style.transform = `translate(${ok ? w * 1.4 : -w * 1.4}px, 20px) rotate(${ok ? 22 : -22}deg)`;
    grade(session, item, ok);
    setTimeout(advance, 280);
  }

  // Pointer drag (touch, pen and mouse). Small movement = tap = flip.
  let drag = null;
  card.addEventListener('pointerdown', (e) => {
    if (busy || e.target.closest('.speaker')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: performance.now() };
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    setPos(drag.dx, drag.dy);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, dy, t: t0 } = drag;
    drag = null;
    card.classList.remove('dragging');
    if (e.type === 'pointercancel') return setPos(0, 0);
    const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      setPos(0, 0);
      flip();
    } else if (Math.abs(dx) > deck.clientWidth * SWIPE_RATIO || (speed > 0.6 && Math.abs(dx) > 40)) {
      decide(dx > 0);
    } else {
      setPos(0, 0);
    }
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);

  const actions = h('div', { class: 'swipe-actions' },
    h('button', { class: 'round-btn bad', type: 'button', 'aria-label': t.forgot, onclick: () => decide(false) },
      icon('close', { size: 28 }), h('span', {}, t.forgot)),
    h('button', { class: 'round-btn neutral small', type: 'button', 'aria-label': t.flip, onclick: flip },
      icon('flip', { size: 22 }), h('span', {}, t.flip)),
    h('button', { class: 'round-btn good', type: 'button', 'aria-label': t.remembered, onclick: () => decide(true) },
      icon('check', { size: 28 }), h('span', {}, t.remembered)),
  );

  render(h('div', { class: 'game game-flash' }, topBar(session), deck, h('p', { class: 'swipe-hint' }, t.swipeHint), actions));
  onKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === '1' || e.key === 'ArrowLeft') decide(false);
    else if (e.key === '2' || e.key === 'ArrowRight') decide(true);
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
  const nextBtn = h('button', { class: 'btn primary wide hidden', type: 'button', onclick: () => advance() }, t.next, icon('chevronRight', { size: 20 }));

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
      verdict(ok),
      mode !== 'quiz' || !ok ? h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), h('span', { class: 'eq' }, '='), h('span', {}, item.answer)) : null,
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
  const skipBtn = h('button', { class: 'btn', type: 'button', onclick: () => check(true) }, t.dontKnow);

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
      verdict(ok),
      h('div', { class: 'reveal' }, termBlock(item, { size: 'md', reading: true }), speakerBtn(item.term)),
      noteEl(item),
    );
    say(item.term);
    checkBtn.textContent = t.next;
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

function scoreRing(pct) {
  const NS = 'http://www.w3.org/2000/svg';
  const R = 52;
  const C = 2 * Math.PI * R;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'circle');
  const bar = document.createElementNS(NS, 'circle');
  for (const c of [track, bar]) {
    c.setAttribute('cx', '60');
    c.setAttribute('cy', '60');
    c.setAttribute('r', String(R));
  }
  track.setAttribute('class', 'ring-track');
  bar.setAttribute('class', 'ring-bar');
  bar.setAttribute('stroke-dasharray', `0 ${C}`);
  svg.append(track, bar);
  // Grow from empty on the next frame so the CSS transition has a start value.
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dasharray', `${(C * pct) / 100} ${C}`)));
  return svg;
}

// Counts a number up inside `el` (skipped when the user prefers reduced motion).
function countUp(el, to, suffix = '') {
  el.textContent = `${to}${suffix}`;
  if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 3)))}${suffix}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const CONFETTI_COLORS = ['#f5b84a', '#5b75f6', '#3ccf73', '#ff5c66', '#a78bfa'];

// A short burst of falling pieces; pointer-events:none so it never blocks taps.
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return h('div', { class: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: 28 }, (_, i) => h('i', {
      style: `left:${(i * 37) % 100}%;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};animation-delay:${(i % 7) * 0.08}s;--drift:${((i * 53) % 80) - 40}px`,
    })));
}

function showResults(session) {
  const t = state.t;
  onKeys(null);
  const total = session.items.length;
  const pct = total ? Math.round((session.correct / total) * 100) : 0;
  const secs = Math.round((Date.now() - session.startedAt) / 1000);
  const prev = getStats().sessions.filter((x) => x.lang === session.lang && x.n).at(-1);
  const prevPct = prev ? Math.round((prev.c / prev.n) * 100) : null;
  logSession({ lang: session.lang, mode: session.mode, n: total, c: session.correct, s: secs, t: Date.now() });
  const message = pct >= 90 ? t.resultGreat : pct >= 60 ? t.resultGood : t.resultKeep;

  const goal = settings.dailyGoal;
  const today = todayAnswers(session.lang);
  const goalJustMet = goal > 0 && session.before < goal && today >= goal;
  const days = streak(dayTotals(session.lang));
  const diff = prevPct === null ? null : pct - prevPct;

  const pctNum = h('b', {}, `${pct}%`);
  const mastered = [...session.mastered.values()];
  const badges = h('div', { class: 'result-badges' },
    diff ? h('span', { class: `chip ${diff > 0 ? 'up' : 'down'}` }, `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% ${t.vsLast}`) : null,
    days ? h('span', { class: 'chip' }, icon('flame', { size: 14 }), `${days} ${t.days}`) : null,
    goal > 0 ? h('span', { class: `chip${today >= goal ? ' up' : ''}` }, icon('target', { size: 14 }), t.goalToday.replace('{n}', today).replace('{goal}', goal)) : null,
  );
  const masteredBox = mastered.length
    ? h('div', { class: 'mastered-box' },
        h('strong', {}, icon('sparkles', { size: 18 }), t.newMastered.replace('{n}', mastered.length)),
        h('div', { class: 'mastered-words' }, mastered.slice(0, 12).map((it) => h('span', { class: 'word-chip', lang: it.lang }, it.term))))
    : null;

  const reviewList = session.wrong.length
    ? h('ul', { class: 'group list' }, session.wrong.map((it) =>
        h('li', { class: 'row' },
          h('span', { class: 'rv-term' }, h('span', { lang: it.lang }, it.term), readingSmall(it)),
          h('span', { class: 'rv-answer' }, it.answer),
          speakerBtn(it.term, { lang: it.lang }),
        )))
    : h('p', { class: 'empty' }, icon('check', { size: 20 }), t.perfect);

  render(h('div', { class: 'results' },
    h('div', { class: 'game-top' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.done, onclick: exitGame }, icon('close')),
      h('span', { class: 'top-title' }, t.resultTitle),
      h('span', { class: 'icon-btn-spacer' }),
    ),
    h('section', { class: 'result-hero' },
      goalJustMet || pct === 100 ? confetti() : null,
      h('div', { class: 'ring-wrap' }, scoreRing(pct), h('div', { class: 'ring-label' }, pctNum, h('span', {}, t.accuracy))),
      h('p', { class: 'result-msg' }, goalJustMet ? t.goalReached : message),
      badges,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, `${session.correct}/${total}`), h('span', {}, t.score)),
        h('div', { class: 'stat' }, h('b', {}, `${secs} ${t.sec}`), h('span', {}, t.time)),
      ),
    ),
    masteredBox,
    groupTitle(t.reviewWrong),
    reviewList,
    h('div', { class: 'actions stack' },
      session.wrong.length
        ? h('button', { class: 'btn primary big', type: 'button', onclick: () => startGame(shuffle(session.wrong), session.pool) }, icon('repeat', { size: 20 }), t.practiceWrong)
        : null,
      h('button', { class: `btn big${session.wrong.length ? '' : ' primary'}`, type: 'button', onclick: () => startGame(pickItems(session.pool, settings.count), session.pool) }, icon('play', { size: 18, fill: true }), t.playAgain),
      h('button', { class: 'btn ghost', type: 'button', onclick: exitGame }, t.done),
    ),
  ));
  countUp(pctNum, pct, '%');
}
