// Browser acceptance checks against an isolated database. Requires Playwright and Chrome.
// PLAYWRIGHT_MODULE may point to an installed playwright-core package; no project npm changes needed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const scratch = mkdtempSync(join(tmpdir(), 'tracefix-add-money-ui-'));
const env = { ...process.env, TRACEFIX_DB: join(scratch, 'checks.sqlite3'), TRACEFIX_SIM_TICKER: '0', TRACEFIX_SANDBOX_CORRECTIONS: '1' };
const socket = createServer();
await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise(r => socket.close(r));
const base = `http://127.0.0.1:${port}`;
const server = spawn(join(root, '.venv/bin/python'), ['-m', 'uvicorn', 'tracefix.app:app', '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warning'], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
let serverErrors = '';
server.stderr.on('data', b => { serverErrors += b; });
let browser;
const errors = [], results = [], fixtures = [], contexts = new Set();
let passed = false;
const check = (value, label) => { assert.ok(value, label); results.push(label); };
function drive(run, action = 'idle', ms = 60000) {
  execFileSync(join(root, '.venv/bin/python'), ['-c', `from tracefix.transfer import engine; engine.${action === 'idle' ? 'run_until_idle' : 'advance'}(${JSON.stringify(run)}, ${ms})`], { cwd: root, env });
}
async function session(role, run) {
  const r = await fetch(base + '/api/transfer/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, ...(run ? { run_id: run } : {}) }) });
  assert.equal(r.status, 200); return r.json();
}
async function api(s, path, body) {
  const r = await fetch(base + '/api/transfer' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(r.status, 200, await r.clone().text()); return r.json();
}
async function context(width = 1440) {
  const c = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  await c.tracing.start({ screenshots: true, snapshots: true, sources: true });
  contexts.add(c);
  const close = c.close.bind(c);
  c.close = async () => { await c.tracing.stop(); contexts.delete(c); await close(); };
  c.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  return c;
}
async function ready(p, selector) {
  await p.locator(selector).first().waitFor();
  await p.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
}
async function noOverflow(p, label) {
  const dims = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(dims[0] <= dims[1], `${label}: no page overflow (${dims.join('/')})`);
}
try {
  await new Promise((resolveReady, reject) => {
    const deadline = Date.now() + 20000;
    const attempt = async () => {
      if (server.exitCode !== null) return reject(new Error(serverErrors));
      try { if ((await fetch(base + '/')).ok) return resolveReady(); } catch { /* readiness */ }
      if (Date.now() > deadline) return reject(new Error('Server readiness timed out: ' + serverErrors));
      setTimeout(attempt, 100);
    }; attempt();
  });
  browser = await chromium.launch({ executablePath: process.env.TRACEFIX_CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const first = await context(), home = await first.newPage();
  await home.goto(base + '/'); await ready(home, '.home-add-money');
  await home.getByRole('link', { name: 'Explore Add money', exact: true }).click();
  await ready(home, '#start-walkthrough');
  check(await home.locator('#start-walkthrough').isDisabled(), 'Fresh visit requires explicit scenario selection');
  check(await home.locator('input[name=scenario]:checked').count() === 0, 'Automatic backend run is not a chosen scenario');
  check(await home.locator('body').evaluate(e => getComputedStyle(e).backgroundColor) === 'rgb(247, 249, 252)', 'Walkthrough uses the shared light canvas');
  check(await home.getByRole('link', { name: 'Explore investigation demo', exact: true }).isVisible(), 'Investigation demo has a prominent hero action');
  check(await home.getByRole('link', { name: 'Open investigation workspace', exact: true }).isVisible(), 'Whole investigation preview is an accessible link');
  await home.getByRole('link', { name: 'Explore investigation demo', exact: true }).click();
  await ready(home, '.ws');
  check(first.pages().length === 1, 'Fresh investigation demo opens in the same tab');
  await home.goBack(); await ready(home, '#start-walkthrough');
  check(await home.locator('#start-walkthrough').isDisabled(), 'Returning from a demo still requires explicit scenario selection');
  await first.close();

  const mobileSetup = await context(390), mobile = await mobileSetup.newPage();
  await mobile.goto(base + '/mfs'); await ready(mobile, '#start-walkthrough');
  for (const title of ['Wallet processing stops', 'Confirmation goes missing', 'The records do not match', 'The original transfer is delayed']) {
    await mobile.getByRole('radio', { name: new RegExp(title) }).check();
    check((await mobile.locator('.am-selection-note').innerText()).includes(title), `Mobile selection names ${title}`);
    const start = await mobile.locator('#start-walkthrough').boundingBox();
    check(start && start.y >= 0 && start.y + start.height <= 1000 && start.height >= 48, `Mobile start action remains reachable for ${title}`);
  }
  await mobileSetup.close();

  for (const [scenario, title] of [['worker_fault', 'Wallet processing stops'], ['lost_ack', 'Confirmation goes missing'], ['mapping_ambiguity', 'The records do not match'], ['late_completion', 'The original transfer is delayed']]) {
    const c = await context(), p = await c.newPage();
    await p.goto(base + '/mfs'); await ready(p, '#continue-walkthrough');
    await p.locator('#setup').evaluate(e => { e.open = true; });
    await p.getByRole('radio', { name: new RegExp(title) }).check();
    await p.locator('#start-walkthrough').click();
    await p.waitForURL('**/customer/payment?run=*'); await ready(p, '#amount');
    const run = new URL(p.url()).searchParams.get('run');
    check(c.pages().length === 1 && await p.locator('body').getAttribute('data-surface') === 'customer', `${scenario}: same-tab customer navigation`);
    if (scenario === 'worker_fault') {
      for (const amount of ['0', '0.99', '5000.01', '1000.001']) {
        await p.getByRole('textbox', { name: 'Amount in taka' }).fill(amount);
        check(await p.getByRole('button', { name: 'Review request' }).isDisabled(), `Invalid amount ${amount} blocked`);
      }
      await p.getByRole('textbox', { name: 'Amount in taka' }).fill('1250.50');
      await p.getByRole('radio').nth(1).focus();
      await p.getByRole('radio').nth(1).press('Space');
      const bank = await p.getByRole('radio').nth(1).inputValue();
      await p.reload(); await ready(p, '#amount');
      check(await p.locator('#amount').inputValue() === '1250.50' && await p.locator(`input[value="${bank}"]`).isChecked(), 'Draft amount and bank survive refresh');
      await p.getByRole('button', { name: 'Review request' }).click();
      await p.reload(); await ready(p, '.review-list');
      check(await p.getByRole('heading', { name: 'Review your request' }).isVisible(), 'Distinct review survives refresh without submitting');
      await p.getByRole('button', { name: 'Edit details' }).click();
      check(await p.locator('#amount').inputValue() === '1250.50', 'Edit details preserves amount');
    }
    await p.getByRole('button', { name: 'Review request' }).click();
    if (scenario === 'worker_fault') {
      // Let the server commit, then lose the HTTP acknowledgement. Retry must reuse the intent key.
      await p.route('**/api/transfer/payments', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fetch(); await route.abort('failed');
      }, { times: 1 });
      await p.getByRole('button', { name: /^Confirm and add/ }).click();
      await p.getByRole('status').filter({ hasText: 'We could not confirm the request result' }).waitFor();
      await p.reload(); await ready(p, '.review-list');
    }
    await p.getByRole('button', { name: /^Confirm and add/ }).evaluate(el => { el.click(); el.click(); });
    await p.waitForURL(/\/customer\/payment\/pay_/); await ready(p, '.status-title');
    const payment = new URL(p.url()).pathname.split('/').at(-1);
    const presenter = await session('presenter', run), staff = await session('staff', run), customer = await session('customer', run);
    const saved = (await api(presenter, '/runs')).find(r => r.id === run);
    check(saved.payments.length === 1, `${scenario}: repeated confirmation creates one payment`);
    drive(run, 'advance', 15000);
    await p.reload(); await ready(p, '.status-title');
    check((await p.locator('.status-hero').innerText()).includes('not confirmed'), `${scenario}: uncertain transfer is not credit success`);
    const note = p.getByRole('textbox', { name: 'Note for the investigator' });
    await note.fill('Keep this complaint while records update.');
    drive(run, 'advance', 100);
    await p.reload(); await ready(p, '.status-title');
    check(await note.inputValue() === 'Keep this complaint while records update.', `${scenario}: complaint draft survives refresh`);
    await p.getByRole('link', { name: 'Back to walkthrough', exact: true }).click();
    await ready(p, '#continue-walkthrough');
    check(new URL(p.url()).searchParams.get('run') === run, `${scenario}: return preserves exact run`);
    check((await p.locator('#continue-walkthrough').getAttribute('href')).includes('/admin/cases/' + payment), `${scenario}: resume opens existing investigation`);
    check((await p.locator('.am-demo-card').getAttribute('href')).includes('/admin/cases/' + payment) && new URL(await p.locator('.am-demo-card').getAttribute('href'), base).searchParams.get('run') === run, `${scenario}: prominent demo preserves selected payment and run`);
    const popupPromise = p.waitForEvent('popup');
    await p.getByRole('link', { name: 'Open companion investigation view' }).click();
    const companion = await popupPromise; await ready(companion, '.gnode');
    check(await companion.locator('body').getAttribute('data-surface') === 'admin', `${scenario}: explicit companion opens staff document`);
    await companion.close();
    await p.locator('#continue-walkthrough').click(); await ready(p, '.gnode');
    let liveCustomer;
    if (scenario === 'worker_fault') {
      liveCustomer = await c.newPage();
      await liveCustomer.goto(`${base}/customer/payment/${payment}?run=${run}`); await ready(liveCustomer, '.status-title');
      const typing = liveCustomer.getByRole('textbox', { name: 'Note for the investigator' });
      await typing.fill('Keep my complaint and cursor during live updates.');
      await typing.evaluate(e => { e.focus(); e.setSelectionRange(2, 5); });
    }
    await p.getByRole('button', { name: 'Start investigation', exact: true }).click();
    if (liveCustomer) {
      await liveCustomer.getByText('Investigation started', { exact: true }).waitFor();
      check(await liveCustomer.getByRole('textbox', { name: 'Note for the investigator' }).evaluate(e => e.value === 'Keep my complaint and cursor during live updates.' && document.activeElement === e && e.selectionStart === 2 && e.selectionEnd === 5), 'Live update preserves complaint text, focus and selection');
      await liveCustomer.close();
    }
    drive(run, 'idle', scenario === 'late_completion' ? 20000 : 60000);
    await p.reload(); await ready(p, '.gnode');
    const snap = await api(staff, '/staff/cases/' + payment);
    check(snap.investigation.status === 'concluded', `${scenario}: investigation checks conclude`);
    await p.getByRole('link', { name: 'Back to Add-money walkthrough', exact: true }).click();
    await ready(p, '#continue-walkthrough');
    check((await p.locator('#continue-walkthrough').getAttribute('href')).includes('/admin/cases/' + payment), `${scenario}: decision/outcome resume uses saved record`);
    if (scenario !== 'mapping_ambiguity') check(await p.locator('#continue-walkthrough').innerText() === 'Review the decision', `${scenario}: decision stage never opens a fresh form`);
    await p.locator('#continue-walkthrough').click();
    if (scenario === 'mapping_ambiguity') { await ready(p, '.rep-doc'); await p.getByRole('link', { name: 'Back to workspace' }).click(); }
    await ready(p, '.gnode');
    if (scenario === 'worker_fault' || scenario === 'lost_ack') {
      await p.getByRole('tab', { name: 'Plan' }).click();
      await p.getByRole('button', { name: 'Approve correction' }).click();
      drive(run);
    } else if (scenario === 'late_completion') {
      check(snap.plan.kind === 'MONITOR_ORIGINAL', 'Delayed original recommends monitoring');
      drive(run, 'advance', 60000);
    } else {
      check(snap.case.resolution === 'handoff' && snap.payment.status === 'UNCERTAIN', 'Owned handoff remains unconfirmed');
    }
    const final = await api(staff, '/staff/cases/' + payment);
    check(final.payment.status === (scenario === 'mapping_ambiguity' ? 'UNCERTAIN' : 'COMPLETED'), `${scenario}: correct final payment status`);
    const credits = Number(execFileSync(join(root, '.venv/bin/python'), ['-c', `from tracefix import store; db=store.connect(); print(db.execute("SELECT COUNT(*) FROM tx_postings WHERE payment_id=? AND leg='WALLET_CREDIT'", (${JSON.stringify(payment)},)).fetchone()[0]); db.close()`], { cwd: root, env }).toString());
    check(credits === (scenario === 'mapping_ambiguity' ? 0 : 1), `${scenario}: ledger contains the correct number of credits`);
    if (scenario === 'late_completion') check(final.plan.status === 'superseded', 'Late completion supersedes stale plan');
    await p.reload(); await ready(p, '.gnode');
    const beforeEvents = final.events.length;
    await p.getByRole('button', { name: 'Replay', exact: true }).click();
    await p.getByRole('button', { name: 'Pause replay', exact: true }).click();
    check((await api(staff, '/staff/cases/' + payment)).events.length === beforeEvents, `${scenario}: replay reads saved history`);
    await p.getByRole('button', { name: 'Exit replay', exact: true }).click();
    if (scenario === 'worker_fault') {
      const world = p.locator('.graph-world');
      const camera = await world.evaluate(e => e.style.transform);
      await p.getByRole('button', { name: 'Zoom in (+)', exact: true }).click();
      check(await world.evaluate(e => e.style.transform) !== camera, 'Canvas zoom changes the camera');
      await p.getByRole('button', { name: 'Fit view (0)', exact: true }).click();
      const fitted = await world.evaluate(e => e.style.transform);
      const point = await p.locator('.graph-host').evaluate(e => {
        const b = e.getBoundingClientRect();
        for (const dy of [80, 120, 180]) {
          const x = b.right - 24, y = b.bottom - dy;
          if (!document.elementFromPoint(x, y)?.closest('.gnode,button,.ghub,.graph-toolbar,.graph-legend')) return { x, y };
        }
        throw new Error('No canvas background available for pan check');
      });
      await p.mouse.move(point.x, point.y); await p.mouse.down(); await p.mouse.move(point.x - 80, point.y - 30); await p.mouse.up();
      check(await world.evaluate(e => e.style.transform) !== fitted, 'Canvas pan changes the camera');
      await p.getByRole('button', { name: 'Fit view (0)', exact: true }).click();
      await p.getByRole('tab', { name: 'Plan' }).click();
      const citation = p.locator('.ws-inspect button.cite').first(), observation = await citation.innerText();
      await citation.click();
      check(await p.getByRole('tab', { name: 'Evidence' }).getAttribute('aria-selected') === 'true' && (await p.locator('.ws-inspect').innerText()).includes(observation), 'Citation opens its saved observation in Evidence');
      let release, began;
      const held = new Promise(r => { release = r; }), entered = new Promise(r => { began = r; });
      await p.route('**/api/transfer/staff/cases/*/report', async route => { began(); await held; await route.continue(); }, { times: 1 });
      await p.getByRole('link', { name: 'Report', exact: true }).click(); await entered;
      await p.goBack(); await ready(p, '.gnode');
      const oldSnapshot = p.waitForResponse(r => /\/api\/transfer\/staff\/cases\/[^/?]+$/.test(new URL(r.url()).pathname));
      release(); await oldSnapshot;
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      check(await p.locator('.ws').count() === 1 && await p.locator('.rep-doc').count() === 0 && !new URL(p.url()).pathname.endsWith('/report'), 'Slow report response cannot overwrite Back navigation');
    }
    await p.getByRole('link', { name: 'Report', exact: true }).click(); await ready(p, '.rep-doc');
    if (scenario === 'worker_fault') {
      const tab = c.waitForEvent('page');
      await p.getByRole('link', { name: 'Back to workspace' }).click({ modifiers: ['Control'] });
      const extra = await tab; await ready(extra, '.gnode');
      check(await p.locator('.rep-doc').isVisible(), 'Modifier click opens a new tab without navigating the report');
      await extra.close();
    }
    check((await p.locator('.am-report-outcome').innerText()).includes(scenario === 'mapping_ambiguity' ? 'credit unconfirmed' : 'Wallet credit confirmed'), `${scenario}: report outcome is accurate`);
    for (const format of ['Markdown', 'HTML']) {
      const downloaded = p.waitForEvent('download'); await p.getByRole('button', { name: format, exact: true }).click();
      check((await downloaded).suggestedFilename().endsWith(format === 'HTML' ? '.html' : '.md'), `${scenario}: ${format} export works`);
    }
    await p.getByRole('link', { name: 'Back to workspace' }).click(); await ready(p, '.gnode');
    await p.goBack(); await ready(p, '.rep-doc'); await p.goForward(); await ready(p, '.gnode');
    check(new URL(p.url()).searchParams.get('run') === run, `${scenario}: Back/Forward preserves page and run`);
    fixtures.push({ run, payment, caseId: final.case.id, staff, customer });
    await c.close();
    console.log('PASS journey:', scenario);
  }

  const f = fixtures[0];
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const c = await context(width), p = await c.newPage();
    for (const [name, path, selector] of [['home', '/', '.home-add-money'], ['walkthrough', '/mfs?run=' + f.run, '#continue-walkthrough'], ['form', '/customer/payment', '.pay-card'], ['status', `/customer/payment/${f.payment}?run=${f.run}`, '.status-title'], ['board', `/admin/cases/${f.payment}?run=${f.run}`, '.gnode'], ['report', `/admin/cases/${f.caseId}/report?run=${f.run}`, '.rep-doc']]) {
      await p.goto(base + path); await ready(p, selector); await noOverflow(p, `${name} at ${width}px`);
      if (name === 'home') check(await p.getByRole('link', { name: 'Add money', exact: true }).isVisible(), `Homepage Add money navigation at ${width}px`);
      if (name === 'walkthrough' && width <= 768) {
        await p.getByRole('button', { name: 'View all steps' }).click();
        check(await p.getByRole('button', { name: 'Hide steps' }).getAttribute('aria-expanded') === 'true', `All walkthrough stages reachable at ${width}px`);
      }
      if (name === 'board' && width <= 1040) {
        await p.getByRole('button', { name: 'Queue', exact: true }).click();
        check(await p.getByRole('dialog', { name: 'Payment queue' }).isVisible(), `Queue drawer at ${width}px`);
        await p.keyboard.press('Shift+Tab');
        check(await p.getByRole('dialog', { name: 'Payment queue' }).evaluate(e => e.contains(document.activeElement)), `Queue traps keyboard focus at ${width}px`);
        await p.keyboard.press('Escape');
        check(await p.getByRole('button', { name: 'Queue', exact: true }).evaluate(e => e === document.activeElement), `Queue returns focus at ${width}px`);
        await p.getByRole('button', { name: 'Details', exact: true }).click();
        check(await p.getByRole('tab', { name: 'Evidence' }).isVisible(), `Inspector tabs reachable at ${width}px`);
        await p.getByRole('tab', { name: 'Evidence' }).click();
        await p.keyboard.press('ArrowRight');
        check(await p.getByRole('tab', { name: 'Hypotheses' }).evaluate(e => e === document.activeElement && e.getAttribute('aria-selected') === 'true'), `Inspector keyboard navigation at ${width}px`);
        await p.getByRole('button', { name: 'Activity', exact: true }).click();
        check(await p.getByRole('region', { name: 'Investigation log' }).isVisible(), `Activity reachable at ${width}px`);
        await p.getByRole('button', { name: 'Board', exact: true }).click();
        await p.getByRole('button', { name: 'Zoom in (+)', exact: true }).click();
        await p.getByRole('button', { name: 'Zoom out (-)', exact: true }).click();
        await p.getByRole('button', { name: 'Fit view (0)', exact: true }).click();
        await p.locator('.gnode').first().evaluate(e => e.click());
        check(await p.getByRole('button', { name: 'Details', exact: true }).getAttribute('aria-pressed') === 'true', `Node selection opens Details at ${width}px`);
        await p.getByText('More', { exact: true }).click();
        check(await p.getByRole('link', { name: 'Report', exact: true }).isVisible(), `Secondary actions reachable at ${width}px`);
        await p.getByRole('link', { name: 'Report', exact: true }).focus();
        await p.keyboard.press('Escape');
        check(await p.locator('.am-board-menu summary').evaluate(e => e === document.activeElement && !e.parentElement.open), `Secondary menu closes and restores focus at ${width}px`);
      }
    }
    await c.close(); console.log('PASS responsive:', width);
  }
  const c = await context(), p = await c.newPage();
  await api(await session('presenter'), '/runs', { scenario: 'worker_fault', replaces: f.run });
  const handoff = fixtures[2];
  await api(await session('presenter'), '/runs', { scenario: 'worker_fault', replaces: handoff.run });
  await p.goto(base + '/admin/cases/' + handoff.payment + '?run=' + handoff.run); await ready(p, '.gnode');
  check(await p.getByRole('button', { name: 'Investigate again', exact: true }).isDisabled(), 'Direct archived staff bookmark disables active-run controls');
  await p.goto(base + '/customer/payment?run=' + fixtures[1].run); await ready(p, '.pay-card');
  check(await p.getByRole('heading', { name: 'Open your Add money journey' }).isVisible(), 'Fresh customer bookmark checks a journey without presenter projections');
  await p.goto(base + '/mfs?run=run_unavailable'); await ready(p, '.fatal');
  check(await p.getByRole('heading', { name: 'We could not open that journey' }).isVisible(), 'Unknown run has explicit recovery');
  await p.goto(base + '/mfs?run=' + f.run); await ready(p, '#continue-walkthrough');
  check((await p.locator('.am-current').innerText()).includes('Archived'), 'Exact archived run is readable');
  await p.getByText('Presentation controls', { exact: true }).click();
  check(await p.getByRole('button', { name: 'Pause', exact: true }).isDisabled(), 'Archived clock mutations disabled');
  await p.goto(base + '/customer/payment?run=' + f.run); await ready(p, '.pay-card');
  check(await p.getByRole('heading', { name: 'This journey is archived' }).isVisible(), 'Archived form cannot create a new payment');
  // Older customer records have no public run association. Do not borrow the current session run.
  await p.goto(base + '/customer/payment?run=' + fixtures.at(-1).run); await ready(p, '.pay-card');
  await p.evaluate(id => sessionStorage.removeItem('tf.pay.run.' + id), f.payment);
  await p.reload(); await ready(p, '.act-list');
  check(!(await p.locator(`a[href^="/customer/payment/${f.payment}"]`).getAttribute('href')).includes('run='), 'Unknown old payment association does not use current run');
  // Existing run, outside the API's bounded recent list: no silent fallback.
  const presenter = await session('presenter');
  for (let i = 0; i < 13; i++) await api(presenter, '/runs', { scenario: 'worker_fault' });
  await p.goto(base + '/mfs?run=' + f.run); await ready(p, '.am-recovery');
  check(await p.getByRole('heading', { name: 'This run is not in the recent list' }).isVisible(), 'Unavailable recent run has explicit recovery');
  await c.close();
  check(errors.length === 0, 'No uncaught browser errors: ' + errors.join('; '));
  passed = true;
  writeFileSync(join(scratch, 'results.json'), JSON.stringify({ results, fixtures: fixtures.map(({run,payment,caseId}) => ({run,payment,caseId})) }, null, 2));
  console.log(`PASS ${results.length} browser assertions.` + (process.env.TRACEFIX_KEEP_UI_ARTIFACTS === '1' ? ` Evidence: ${scratch}/results.json` : ' Temporary database removed.'));
} finally {
  if (!passed) for (const c of contexts) {
    await c.tracing.stop({ path: join(scratch, 'failure-' + contexts.size + '.zip') }).catch(() => {});
    for (const p of c.pages()) console.error('Failure page:', p.url());
  }
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise(r => server.exitCode !== null ? r() : server.once('exit', r));
  if (process.env.TRACEFIX_KEEP_UI_ARTIFACTS !== '1') rmSync(scratch, { recursive: true, force: true });
}
