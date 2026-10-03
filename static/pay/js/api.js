// Authenticated API access and the live event stream.
//
// Each browser tab holds its own scoped, server-issued opaque token in sessionStorage (one key per role), so a
// customer tab and an admin tab never overwrite one another. Roles and ownership are enforced by the server; nothing
// here decides what a session may do.

const base = '/api/transfer';
const KEY = (role) => 'tf.pay.session.' + role;

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || 'Request failed');
    this.status = status;
    this.detail = detail;
  }
}

let auth = { role: null, runId: null, token: null };

export function sessionInfo() {
  return auth;
}

async function issue(role, runId) {
  const r = await fetch(base + '/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, ...(runId ? { run_id: runId } : {}) }),
  });
  if (!r.ok) throw new ApiError(r.status, (await r.json().catch(() => ({}))).detail || 'Could not start a session.');
  const s = await r.json();
  sessionStorage.setItem(KEY(role), JSON.stringify(s));
  return s;
}

export async function startSession(role, runId) {
  let s = null;
  try {
    s = JSON.parse(sessionStorage.getItem(KEY(role)) || 'null');
  } catch {
    s = null;
  }
  if (!s || s.role !== role || (runId && s.run_id !== runId)) s = await issue(role, runId);
  auth = { role, runId: s.run_id, token: s.token, actor: s.actor, label: s.label };
  return auth;
}

async function renew() {
  const s = await issue(auth.role, auth.runId);
  auth = { ...auth, token: s.token, runId: s.run_id };
}

export async function api(method, path, body, { key, retry = true } = {}) {
  const headers = { Authorization: 'Bearer ' + auth.token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401 && retry) {
    await renew();
    return api(method, path, body, { key, retry: false });
  }
  const type = r.headers.get('content-type') || '';
  const data = type.includes('json') ? await r.json().catch(() => ({})) : await r.text();
  if (!r.ok) throw new ApiError(r.status, (typeof data === 'object' && data.detail) || 'Request failed');
  return data;
}

export const get = (path) => api('GET', path);
export const post = (path, body, key) => api('POST', path, body ?? {}, { key });

// Staff may already read all demo payments. Use a separate presenter token solely for run availability;
// never switch the active staff token or give customer pages presenter/staff projections.
export async function staffRunState(runId) {
  if (auth.role !== 'staff') throw new ApiError(403, 'Run availability is a staff demo control.');
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(KEY('presenter')) || 'null'); } catch { /* new scoped session */ }
  if (!s || s.run_id !== runId) s = await issue('presenter', runId);
  let r = await fetch(base + '/runs', { headers: { Authorization: 'Bearer ' + s.token } });
  if (r.status === 401) {
    s = await issue('presenter', runId);
    r = await fetch(base + '/runs', { headers: { Authorization: 'Bearer ' + s.token } });
  }
  if (!r.ok) throw new ApiError(r.status, 'Could not verify whether this journey is active.');
  return (await r.json()).find(run => run.id === runId)?.status || 'unavailable';
}

export async function download(path, filename) {
  const r = await fetch(base + path, { headers: { Authorization: 'Bearer ' + auth.token } });
  if (!r.ok) throw new ApiError(r.status, 'Download failed');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------------------------------------------
// Live stream: fetch-based SSE (native EventSource cannot send a bearer header), duplicate suppression by event id,
// reconnect from the last accepted cursor, a fresh authorized snapshot after any interruption, and a short polling
// fallback that reads the same saved projections when streaming is unavailable.
export class LiveStream {
  constructor({ scope, cursor = 0, onEvent, onStatus = () => {}, onResync = null }) {
    Object.assign(this, { scope, cursor, onEvent, onStatus, onResync });
    this.seen = new Set();
    this.stopped = false;
    this.failures = 0;
    this.controller = null;
  }

  start() {
    this.stopped = false;
    this.loop();
    return this;
  }

  stop() {
    this.stopped = true;
    if (this.controller) this.controller.abort();
  }

  accept(e) {
    if (this.seen.has(e.event_id)) return;
    this.seen.add(e.event_id);
    if (e.sequence > this.cursor) this.cursor = e.sequence;
    this.onEvent(e);
  }

  async loop() {
    let interrupted = false;
    while (!this.stopped) {
      try {
        if (interrupted && this.onResync) {
          const next = await this.onResync();
          if (typeof next === 'number') this.cursor = Math.max(this.cursor, next);
        }
        interrupted = false;
        if (this.failures >= 3) {
          await this.pollWhile(18000);
          this.failures = 1;
          interrupted = true;
          continue;
        }
        await this.read();
        interrupted = true; // stream ended: server restart, proxy timeout or network change
        this.failures += 1;
      } catch (err) {
        if (this.stopped) return;
        interrupted = true;
        this.failures += 1;
        if (err instanceof ApiError && err.status === 401) {
          try {
            await renew();
          } catch {
            /* retried on the next loop */
          }
        }
      }
      if (this.stopped) return;
      this.onStatus(this.failures >= 3 ? 'polling' : 'reconnecting');
      await sleep(Math.min(4000, 400 * 2 ** Math.min(this.failures, 4)));
    }
  }

  async read() {
    this.controller = new AbortController();
    const r = await fetch(`${base}/stream?scope=${encodeURIComponent(this.scope)}&cursor=${this.cursor}`, {
      headers: { Authorization: 'Bearer ' + auth.token, Accept: 'text/event-stream' },
      signal: this.controller.signal,
    });
    if (!r.ok || !r.body) throw new ApiError(r.status, 'Stream unavailable');
    this.failures = 0;
    this.onStatus('live');
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (line) {
          try {
            this.accept(JSON.parse(line.slice(6)));
          } catch {
            /* a malformed frame is ignored; the next resync repairs any gap */
          }
        }
      }
    }
  }

  async pollWhile(ms) {
    this.onStatus('polling');
    const until = Date.now() + ms;
    while (!this.stopped && Date.now() < until) {
      const d = await get(`/events?scope=${encodeURIComponent(this.scope)}&cursor=${this.cursor}`);
      d.events.forEach((e) => this.accept(e));
      await sleep(1400);
    }
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
