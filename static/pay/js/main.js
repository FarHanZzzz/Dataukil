// Entry point for the standalone add-money pages. Three documents share this module and differ only in `data-surface`.
import { startSession } from './api.js';
import { clear, h } from './util.js';

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
    teardown = (await mod.mount(app, path, run)) || null;
    if (mine !== token && teardown) teardown();
  } catch (err) {
    if (mine !== token) return;
    clear(app);
    app.append(h('main', { class: 'fatal' },
      h('h1', { text: 'This page could not load' }),
      h('p', { text: err && err.detail ? err.detail : 'The server did not respond. Check that the application is running and reload.' }),
      h('button', { class: 'btn btn--primary', type: 'button', text: 'Reload', onclick: () => location.reload() })));
  }
}

window.addEventListener('tf:navigate', route);
window.addEventListener('popstate', route);
route();
