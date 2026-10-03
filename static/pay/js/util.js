// Small DOM and formatting helpers. The page's CSP forbids inline style attributes, so dynamic styling goes through
// the CSSOM (element.style.setProperty), which is permitted.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  apply(el, attrs);
  append(el, kids);
  return el;
}

export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  append(el, kids);
  return el;
}

function apply(el, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'css') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
}

function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Replace the children of `el`; null, undefined and false are skipped (the native append would print them). */
export function fill(el, ...kids) {
  clear(el);
  append(el, kids);
  return el;
}

export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- formatting -------------------------------------------------------------------------------------------------
export function taka(minor, withSymbol = true) {
  const v = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? '\u09F3' + v : v;
}

export function takaShort(minor) {
  return minor % 100 === 0 ? '\u09F3' + (minor / 100).toLocaleString('en-US') : taka(minor);
}

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export function hms(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : TIME.format(d);
}

export function dayTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : DAY.format(d);
}

export function simClock(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---- toasts ------------------------------------------------------------------------------------------------------
let toastHost;
export function toast(message, tone = 'info', ms = 4200) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: 'toast toast--' + tone, text: message });
  toastHost.append(t);
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 260);
  }, ms);
}

export function navigate(path, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new Event('tf:navigate'));
}

export function link(href, attrs, ...kids) {
  return h('a', { href, ...attrs, onclick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href);
  } }, ...kids);
}
