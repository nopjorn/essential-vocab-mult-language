// App shell: routing, header navigation, theme, version and update prompts.
// Routes: #/ practice setup · #/progress[/<lang>] · #/help[/<section>] · #/changelog
import { settings, saveSettings, getLastVersion, setLastVersion } from './store.js';
import { state, h, fill, render, loadIndex, setUiLang, toast } from './core.js';
import { uiFor } from './i18n.js';
import { renderSetup } from './setup.js';
import { renderProgress } from './progress.js';
import { renderHelp, renderChangelog } from './info.js';
import { setExitHandler, onKeys } from './game.js';
import { applyTheme } from './theme.js';
import { APP_VERSION } from './app-info.js';

const NAV = [
  ['#/', '🎯', 'navPractice'],
  ['#/progress', '📊', 'navProgress'],
  ['#/help', '📖', 'navHelp'],
];

function renderNav(route) {
  const t = state.t;
  document.querySelector('.brand-name').textContent = t.appName;
  document.querySelector('.brand-tag').textContent = t.tagline;
  document.title = t.appName;
  fill(document.getElementById('nav'), NAV.map(([href, icon, key]) => {
    const active = href === '#/' ? route === '' : route.startsWith(href.slice(2));
    return h('a', { href, class: `nav-item${active ? ' active' : ''}`, 'aria-current': active ? 'page' : null },
      h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'nav-label' }, t[key]));
  }));
}

function route() {
  onKeys(null);
  setUiLang();
  const path = location.hash.replace(/^#\/?/, '');
  const [page, arg] = path.split('/');
  renderNav(page === 'changelog' ? 'help' : page || '');
  document.getElementById('screen').dataset.page = page || 'setup';
  if (page === 'progress') return renderProgress(arg);
  if (page === 'help') return renderHelp(arg);
  if (page === 'changelog') return renderChangelog();
  return renderSetup();
}

function goHome() {
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else route();
}

function announceVersion() {
  const last = getLastVersion();
  if (last && last !== APP_VERSION) {
    const t = state.t;
    toast(t.updatedTo.replace('{v}', APP_VERSION), { action: t.whatsNew, onAction: () => (location.hash = '#/changelog') });
  }
  setLastVersion(APP_VERSION);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  // A controller already exists means this is an update, not the first install.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const t = state.t;
    toast(t.updateReady, { action: t.reload, onAction: () => location.reload(), sticky: true });
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // Home-screen apps on iOS can stay open for days: check for updates when brought back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('SW', e));
}

async function boot() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  try {
    await loadIndex();
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, uiFor(settings.target).loadError));
    return;
  }
  if (!state.index.learn.some((l) => l.code === settings.lang)) {
    settings.lang = state.index.learn[0].code;
    saveSettings();
  }
  setExitHandler(goHome);
  document.querySelector('.brand').addEventListener('click', goHome);
  window.addEventListener('hashchange', route);
  route();
  announceVersion();
  registerServiceWorker();
}

boot();
