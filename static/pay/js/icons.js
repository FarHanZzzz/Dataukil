// Stroke icons on a 24x24 grid. Paths are drawn here (no network, no sprite dependency).

const P = {
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  question: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.8M12 17h.01',
  warning: 'M12 3.5 2.5 20h19zM12 10v4.2M12 17h.01',
  ring: 'M21 12a9 9 0 1 1-9-9',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2 2 4-4',
  key: 'M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10.8 12.2 20 3M17 6l3 3',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v4M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14.5h.01',
  bank: 'M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  reply: 'M9 14 4 9l5-5M4 9h8a8 8 0 0 1 8 8v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  send: 'M4 12 20 4l-5 16-3-6.5zM12 13.5 20 4',
  message: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8.5 10l2 2 4-4',
  radio: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
  cpu: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM10 10h4v4h-4zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3',
  book: 'M5 4a1 1 0 0 1 1-1h13v15H7a2 2 0 0 0-2 2zM5 20v-16M9 8h7M9 12h7',
  tray: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
  badge: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.2 12.2l2.6 2.6 5-5.2',
  scale: 'M12 3v17M5 20h14M5 7h14M7 7l-3.5 7a3.5 3.5 0 0 0 7 0zM17 7l-3.5 7a3.5 3.5 0 0 0 7 0z',
  cornerLeft: 'M20 5v6a4 4 0 0 1-4 4H4M9 10l-5 5 5 5',
  phone: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 18h.01',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M8 5v14M16 5v14',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  target: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronDown: 'm6 9 6 6 6-6',
  chevronUp: 'm6 15 6-6 6 6',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  panelLeft: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 5v14',
  panelRight: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM15 5v14',
  maximize: 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  hand: 'M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V4a1.5 1.5 0 0 1 3 0v7M15 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3a1.5 1.5 0 0 1 2.4-1.8L9 15',
  replay: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  helix: 'M7 3c0 4 10 4 10 9s-10 5-10 9M17 3c0 4-10 4-10 9s10 5 10 9M8.6 7.6h6.8M8.6 16.4h6.8M7.4 12h9.2',
};

const FILLED = new Set(['play']);

export function icon(name, size = 18, cls = '') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  el.setAttribute('class', 'ic ' + cls);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', P[name] || P.question);
  if (FILLED.has(name)) path.setAttribute('class', 'ic-fill');
  el.append(path);
  return el;
}

// Node identity icons for the processing graph.
export const NODE_ICONS = {
  intent: 'file', validation: 'check', authorization: 'shield', idempotency: 'key',
  'funding-check': 'wallet', 'bank-debit': 'bank', 'bank-response': 'reply',
  'ref-mapping': 'link', 'retry-history': 'repeat', 'routing-request': 'send', 'partner-ack': 'message', 'callback-delivery': 'radio',
  'wallet-ingress': 'login', 'durable-queue': 'layers', 'credit-worker': 'cpu', 'wallet-ledger': 'book', 'dead-letter': 'tray',
  'posting-verify': 'badge', reconciliation: 'scale', 'ack-return': 'cornerLeft', 'customer-update': 'phone', 'return-path': 'undo',
};

// Processing-state badges (colour is always paired with an icon and a text label).
export const STATE_ICON = { unknown: 'question', pending: 'clock', running: 'ring', completed: 'check', failed: 'x', unavailable: 'warning' };
