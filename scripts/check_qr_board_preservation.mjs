// Compare graph layout/behavior assets on an identical fixture with the same current light palette.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(new URL('..',import.meta.url).pathname),scratch=mkdtempSync(join(tmpdir(),'dataukil-board-baseline-'));
const baselineRef=process.env.TRACEFIX_BOARD_BASELINE_REF||'0ae097a';
const env={...process.env,TRACEFIX_DB:join(scratch,'fixture.sqlite3'),TRACEFIX_SIM_TICKER:'0'};
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const base=`http://127.0.0.1:${port}`;
const server=spawn(join(root,'.venv/bin/python'),['-m','uvicorn','tracefix.app:app','--host','127.0.0.1','--port',String(port),'--log-level','warning'],{cwd:root,env,stdio:'ignore'});
let browser;
async function api(path,body,token){const r=await fetch(base+'/api/transfer'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,await r.clone().text());return r.json();}
try{
 const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/')).ok)break;}catch{}if(Date.now()>deadline)throw Error('Server readiness failed');await new Promise(r=>setTimeout(r,100));}
 const presenter=await api('/session',{role:'presenter'}),run=await api('/runs',{scenario:'worker_fault'},presenter.token);
 const customer=await api('/session',{role:'customer',run_id:run.id});
 const response=await api('/payments',{run_id:run.id,amount_minor:100000,bank_code:'MCB'},customer.token);
 execFileSync(join(root,'.venv/bin/python'),['-c',`from tracefix.transfer import engine; engine.run_until_idle(${JSON.stringify(run.id)})`],{cwd:root,env});
 const staff=await api('/session',{role:'staff',run_id:run.id});
 browser=await chromium.launch({executablePath:process.env.TRACEFIX_CHROME||'/opt/google/chrome/chrome',args:['--no-sandbox']});
 async function capture(width,baseline){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(({staff,presenter})=>{sessionStorage.setItem('tf.pay.session.staff',JSON.stringify(staff));sessionStorage.setItem('tf.pay.session.presenter',JSON.stringify(presenter));},{staff,presenter});
  if(baseline)await context.route('**/static/pay/**',route=>{
    const path=new URL(route.request().url()).pathname.slice(1);
    const body=execFileSync('git',['show',baselineRef+':'+path],{cwd:root});
    route.fulfill({body,contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.html')?'text/html':'application/octet-stream'});
  });
  const page=await context.newPage();await page.goto(`${base}/admin/cases/${response.payment.id}?run=${run.id}`);await page.locator('.gnode').first().waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const image=await page.locator('.graph').screenshot({path:join(scratch,`${width}-${baseline?'baseline':'current'}.png`),animations:'disabled'});await context.close();return image;
 }
 for(const width of [1440,1920]){
  const before=await capture(width,true),after=await capture(width,false);
  assert.ok(before.equals(after),`Add money board screenshot differs at ${width}px`);
  console.log(`PASS unchanged Add money board: ${width}px identical screenshot`);
 }
 console.log('Board baseline artifacts:',scratch);
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
