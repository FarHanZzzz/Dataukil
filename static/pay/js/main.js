// Entry point for the standalone add-money pages. Three documents share this module and differ only in `data-surface`.
import { startSession } from './api.js';
import { clear, h, link } from './util.js';

const surface = document.body.dataset.surface;
const app = document.getElementById('app');
const ROLE = { customer: 'customer', admin: 'staff', mfs: 'presenter' }[surface];
let teardown = null;
let token = 0;

async function route() {
  const mine = ++token;
  if (teardown) {
    try {
      teardown();
    } catch {
      /* ignore */
    }
    teardown = null;
  }
  clear(app);
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const run = new URLSearchParams(location.search).get('run');
  app.append(h('div', { class: 'boot', role: 'status' }, h('span', { class: 'boot-ring' }), h('span', { text: 'Loading' })));
  try {
    await startSession(ROLE, run);
    const mod = await import(`./${surface}.js`);
    if (mine !== token) return;
    clear(app);
    // A navigation owns its own host. A slow previous response can only paint its detached view.
    const view = h('div', { class: 'page-view' });
    app.append(view);
    const cleanup = (await mod.mount(view, path, run)) || null;
    if (mine !== token) { if (cleanup) cleanup(); return; }
    teardown = cleanup;
    if (mine === token) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (!app.contains(document.activeElement)) app.focus({ preventScroll: true });
    }
  } catch (err) {
    if (mine !== token) return;
    clear(app);
    app.append(h('main', { class: 'fatal' },
      h('h1', { text: err.status === 404 && run ? 'We could not open that journey' : 'This page could not load' }),
      h('p', { text: err && err.detail ? err.detail : 'The server did not respond. Check that the application is running and reload.' }),
      h('button', { class: 'btn btn--primary', type: 'button', text: 'Try again', onclick: () => location.reload() }),
      link('/mfs', { class: 'btn btn--secondary' }, 'View recent journeys')));
  }
}

window.addEventListener('tf:navigate', route);
window.addEventListener('popstate', route);
route();
