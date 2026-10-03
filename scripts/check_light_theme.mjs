// Light-theme acceptance across real documents, saved payments, reports and Studio.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(new URL('..',import.meta.url).pathname),output=mkdtempSync(join(tmpdir(),'dataukil-daylight-'));
const env={...process.env,TRACEFIX_DB:join(output,'fixture.sqlite3'),TRACEFIX_SIM_TICKER:'0'};
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`,server=spawn(join(root,'.venv/bin/python'),['-m','uvicorn','tracefix.app:app','--host','127.0.0.1','--port',String(port),'--log-level','warning'],{cwd:root,env,stdio:'ignore'});
const results=[],errors=[];let browser;
const check=(value,label)=>{assert.ok(value,label);results.push(label);};
async function api(path,body,token){const response=await fetch(base+'/api/transfer'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,200,await response.clone().text());return response.json();}
try{
 const deadline=Date.now()+20000;while(true){try{if((await fetch(base+'/')).ok)break;}catch{}if(Date.now()>deadline)throw Error('Server did not start');await new Promise(r=>setTimeout(r,100));}
 const presenter=await api('/session',{role:'presenter'}),run=await api('/runs',{scenario:'worker_fault'},presenter.token);
 const customer=await api('/session',{role:'customer',run_id:run.id}),payment=await api('/payments',{run_id:run.id,amount_minor:100000,bank_code:'MCB'},customer.token);
 execFileSync(join(root,'.venv/bin/python'),['-c',`from tracefix.transfer import engine; engine.run_until_idle(${JSON.stringify(run.id)})`],{cwd:root,env});
 const staff=await api('/session',{role:'staff',run_id:run.id});
 browser=await chromium.launch({executablePath:process.env.TRACEFIX_CHROME||'/opt/google/chrome/chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(({staff,presenter,customer})=>{for(const [role,value] of Object.entries({staff,presenter,customer}))sessionStorage.setItem('tf.pay.session.'+role,JSON.stringify(value));},{staff,presenter,customer});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const pages=[['home','/','.hero'],['add-money','/mfs','.am-setup'],['qr','/qr-demo','#purchase-form'],['form',`/customer/payment?run=${run.id}`,'.pay-card'],['status',`/customer/payment/${payment.payment.id}?run=${run.id}`,'.status-page'],['board',`/admin/cases/${payment.payment.id}?run=${run.id}`,'.gnode'],['report',`/admin/cases/${payment.payment.id}/report?run=${run.id}`,'.rep-doc'],['dashboard','/customer','.customer-hero'],['operations','/operations','.card'],['studio','/operations/cases/case_1/studio','.graph-card']];
 for(const [name,path,selector] of pages){
  await page.goto(base+path);await page.locator(selector).first().waitFor();await page.evaluate(()=>document.fonts.ready);
  check(await page.locator('body').evaluate(e=>e.classList.contains('theme-light') && getComputedStyle(e).colorScheme==='light'),`${name}: light document and native controls`);
  const dark=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),m=s.backgroundColor.match(/\d+(\.\d+)?/g);return m&&r.width*r.height>2500&&r.width>100&&r.height>22&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('svg')&&!(m.length===4&&+m[3]<.5)&&m.slice(0,3).every(c=>+c<100);}).map(e=>e.className));
  check(!dark.length,`${name}: no remaining dark panels (${dark.join(', ')})`);
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{window.scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   check(dims.scroll<=dims.width,`${name} ${width}: no page overflow ${dims.scroll}/${dims.width}`);
   if(width===390||width===1440)await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true});
  }
  if(name==='home'){
   check(await page.locator('.fx-mountain-img').evaluate(e=>getComputedStyle(e).backgroundImage.includes('hero-landscape.png')),'Supplied landscape is the hero background');
   check(await page.locator('canvas.fx-canvas').evaluate(e=>getComputedStyle(e).display==='none' && e.width===300),'Dark WebGL backdrop stays inactive');
   const image=await page.evaluate(()=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve([i.naturalWidth,i.naturalHeight]);i.onerror=reject;i.src='/static/img/hero-landscape.png';}));check(image[0]===1024&&image[1]===577,'Original hero image loads at its original dimensions');
  }
 }
 await page.goto(base+'/qr-demo');await page.locator('#purchase-form').waitFor();
 const button=page.locator('#purchase-form button[type=submit]');
 async function contrast(){return button.evaluate(e=>{const s=getComputedStyle(e);const luminance=v=>{const c=v.match(/\d+/g).slice(0,3).map(n=>+n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});}
 check(await contrast()>=4.5,'Primary action text has 4.5:1 contrast');await button.hover();check(await contrast()>=4.5,'Hovered primary action text has 4.5:1 contrast');
 check(!errors.length,'No browser runtime errors: '+errors.join('; '));
 writeFileSync(join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,output},null,2));
}catch(error){if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error('Light theme artifacts:',output);throw error;}finally{if(browser)await browser.close();server.kill('SIGTERM');}
