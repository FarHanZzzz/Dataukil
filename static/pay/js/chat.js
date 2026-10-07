import { startSession, get, post } from './api.js';

const $ = (id) => document.getElementById(id);
const storageKey = 'tf.chat.' + (new URLSearchParams(location.search).get('payment_id') || 'standalone');
let chat = null;
let busy = true;
let turns = [];
let pending = null;
// getRandomValues also works on a LAN HTTP origin, where randomUUID is unavailable.
function operationKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
let createKey = operationKey();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bubble(role, text, pendingBubble = false) {
  const node = element('div', `bubble ${role}${pendingBubble ? ' pending' : ''}`);
  node.append(element('span', 'speaker', role === 'user' ? 'You' : 'Assistant'), document.createTextNode(text));
  $('messages').append(node);
  $('messages').scrollTop = $('messages').scrollHeight;
  return node;
}

function setBusy(value) {
  busy = value;
  $('send').disabled = value || !chat;
  $('message').disabled = value || !chat;
  $('new-chat').disabled = value;
  $('send').textContent = value ? 'Processing…' : 'Send message ↑';
  document.querySelectorAll('[data-prompt]').forEach((button) => { button.disabled = value || !chat; });
}

function error(message = '') {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function renderActivity(turn) {
  const allRecords = turns.flatMap((item) => item.datadna);
  $('attempt-count').textContent = String(allRecords.length);
  $('blocked-count').textContent = String(allRecords.filter((record) => record.decision === 'blocked').length);
  $('read-count').textContent = String(turns.reduce((sum, item) => sum + item.protected_reads, 0));
  const activity = $('activity');
  activity.replaceChildren();
  if (!turn) {
    activity.append(element('div', 'empty-state', 'Send a message to see its classification and any gated access attempts.'));
    return;
  }
  const demo = turn.mode === 'demo';
  activity.append(element('p', demo ? 'mode-badge demo' : 'mode-badge', demo ? 'KEYWORD DEMO FALLBACK' : 'LIVE API MODEL'));
  if (demo) activity.append(element('p', 'classification-reason', 'The API was unavailable. This response uses deterministic demo rules and the real DataDNA gates.'));
  activity.append(element('h3', 'activity-heading', turn.deceptive ? 'Deception detected · access attempted' : 'Normal conversation · no access attempted'));
  activity.append(element('p', 'classification-reason', turn.classification_reason));
  for (const record of turn.datadna) {
    const detail = element('details', 'decision');
    detail.append(element('summary', '', `${record.label} · BLOCKED`));
    detail.append(element('p', '', record.summary));
    const attempt = turn.attempts.find((item) => item.tool === (record.tool || record.request));
    if (attempt) detail.append(element('p', '', 'Model proposal: ' + attempt.reason));
    for (const gate of record.gates) {
      const row = element('div', 'gate-result');
      row.append(element('strong', '', `${gate.n}. ${gate.question} · ${gate.status.toUpperCase()}`));
      row.append(element('p', '', gate.headline));
      detail.append(row);
    }
    detail.append(element('p', '', 'Saved decision: ' + record.id + ' · No source read.'));
    activity.append(detail);
  }
  if (!turn.deceptive) activity.append(element('div', 'empty-state', 'The assistant answered from general knowledge. No protected source adapter was called.'));
}

function loadConversation(data) {
  chat = data;
  turns = data.turns || [];
  pending = null;
  $('messages').replaceChildren();
  bubble('assistant', 'Hi! I can explain the Add Money flow. You can also test whether a deceptive request gets past DataDNA. This conversation uses fictional records.');
  for (const turn of turns) {
    bubble('user', turn.message);
    bubble('assistant', (turn.mode === 'demo' ? 'Demo mode · ' : '') + turn.reply);
  }
  $('reference').textContent = `${data.reference} · Linked Add Money simulation`;
  const link = $('investigation-link');
  link.hidden = !data.case_id;
  link.href = `/admin/cases/${encodeURIComponent(data.payment_id)}?run=${encodeURIComponent(data.run_id)}`;
  renderActivity(turns.at(-1));
  sessionStorage.setItem(storageKey, data.id);
}

async function checkModel() {
  $('check-model').disabled = true;
  try {
    const status = await get('/chat/status');
    $('model-name').textContent = status.ready ? status.model : 'Keyword demo ready';
    $('model-status').textContent = status.detail;
    $('model-status').className = status.ready ? 'ready' : '';
  } catch (err) {
    $('model-status').textContent = err.message;
  } finally {
    $('check-model').disabled = false;
  }
}

async function newChat() {
  error();
  setBusy(true);
  try {
    const payment = new URLSearchParams(location.search).get('payment_id');
    const data = await post('/chat/sessions', payment ? { payment_id: payment } : {}, createKey);
    createKey = operationKey();
    loadConversation(data);
    $('message').value = '';
  } catch (err) {
    error(err.message);
  } finally {
    setBusy(false);
    if (chat) $('message').focus();
  }
}

$('chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = $('message').value.trim();
  if (busy || !chat || !text) return;
  error();
  if (!pending || pending.text !== text) pending = { key: operationKey(), text };
  setBusy(true);
  const userBubble = bubble('user', text);
  const waiting = bubble('assistant', 'Classifying your message. Any proposed data read must pass DataDNA…', true);
  try {
    const response = await post(`/chat/sessions/${encodeURIComponent(chat.id)}/messages`, { message: text }, pending.key);
    waiting.remove();
    bubble('assistant', (response.mode === 'demo' ? 'Demo mode · ' : '') + response.reply);
    if (!turns.some((turn) => turn.turn_id === response.turn_id)) turns.push({ message: text, ...response });
    renderActivity(response);
    pending = null;
    $('message').value = '';
  } catch (err) {
    waiting.remove();
    userBubble.remove();
    error(err.message + ' Your message is kept below for retry.');
  } finally {
    setBusy(false);
    $('message').focus();
  }
});

$('message').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('chat-form').requestSubmit();
  }
});
document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    $('message').value = button.dataset.prompt;
    $('message').focus();
  });
});
$('new-chat').addEventListener('click', newChat);
$('check-model').addEventListener('click', checkModel);

async function init() {
  setBusy(true);
  try {
    await startSession('customer');
    checkModel();
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        loadConversation(await get('/chat/sessions/' + encodeURIComponent(saved)));
        setBusy(false);
        return;
      } catch (err) {
        if (err.status !== 404) throw err;
        sessionStorage.removeItem(storageKey);
      }
    }
    await newChat();
  } catch (err) {
    error(err.message);
    setBusy(false);
  }
}
init();
