// Guide (คู่มือการเล่น) and changelog (มีอะไรใหม่) pages.
import { settings } from './store.js';
import { state, h, render, fetchJSON } from './core.js';
import { GUIDE } from './guide.js';
import { APP_VERSION, versionLabel } from './app-info.js';

export function renderHelp(anchor) {
  const t = state.t;
  const sections = GUIDE[settings.target] || GUIDE.th;
  render(
    h('h1', { class: 'page-title' }, `📖 ${t.guideTitle}`),
    h('nav', { class: 'toc' }, sections.map((s) => h('a', { href: `#/help/${s.id}` }, `${s.icon} ${s.title}`))),
    sections.map((s) =>
      h('section', { class: 'card guide', id: `guide-${s.id}` },
        h('h2', {}, `${s.icon} ${s.title}`),
        h('ul', {}, s.items.map((it) =>
          typeof it === 'string' ? h('li', {}, it) : h('li', {}, h('b', {}, it.b), ' ', it.text))),
      )),
    h('p', { class: 'foot' }, h('a', { href: '#/changelog' }, `${t.whatsNew} · ${versionLabel()}`)),
  );
  if (anchor) document.getElementById(`guide-${anchor}`)?.scrollIntoView({ block: 'start' });
}

export async function renderChangelog() {
  const t = state.t;
  let log = [];
  try {
    log = await fetchJSON('data/changelog.json');
  } catch (err) {
    console.error(err);
  }
  render(
    h('h1', { class: 'page-title' }, `✨ ${t.whatsNew}`),
    h('p', { class: 'muted' }, `${t.currentVersion}: ${versionLabel()}`),
    log.map((v) =>
      h('section', { class: 'card changelog' },
        h('div', { class: 'card-head' },
          h('h2', {}, `v${v.version}`, v.version === APP_VERSION ? h('span', { class: 'badge' }, t.current) : null),
          h('span', { class: 'muted' }, v.date),
        ),
        h('ul', {}, (v.changes[settings.target] || v.changes.th).map((c) => h('li', {}, c))),
      )),
  );
}
