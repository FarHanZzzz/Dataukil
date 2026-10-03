// Isolated real-browser acceptance checks for the canonical QR + cash journey.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(new URL('..',import.meta.url).pathname);
const output=mkdtempSync(join(tmpdir(),'dataukil-qr-ui-'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`;
const server=spawn(join(root,'.venv/bin/python'),['-m','uvicorn','tracefix.app:app','--host','127.0.0.1','--port',String(port),'--log-level','warning'],{cwd:root,env:{...process.env,TRACEFIX_DB:join(output,'checks.sqlite3'),TRACEFIX_SIM_TICKER:'0'},stdio:['ignore','ignore','pipe']});
let serverErrors='';server.stderr.on('data',b=>serverErrors+=b);
let browser;const results=[],errors=[];
const check=(condition,label)=>{assert.ok(condition,label);results.push(label);};
async function ready(page,selector){await page.locator(selector).first().waitFor();await page.evaluate(()=>document.fonts.ready);}
async function click(page,name){await page.getByRole('button',{name,exact:true}).click();}
async function overflow(page,label){
 const d=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.workspace,.phone,.desk,.qr-evidence-section,.qr-stage-banner')].map(e=>({class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));
 check(d.document<=d.width,`${label}: page stays in viewport ${d.document}/${d.width}`);
 check(d.panels.every(v=>v.right<=d.width+1),`${label}: panels stay in viewport`);
}
async function journey(profile='confirmed',motion='reduce',upload=false){
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:motion});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/qr-demo');await ready(page,'#purchase-form');check((await page.locator('#current-stage').innerText()).includes('Start with the purchase'),'Fresh visit starts at purchase stage');
 if(profile!=='confirmed'){
  await page.locator('.qr-presenter > summary').click();await page.locator('#purchase-profile').selectOption(profile);
 }
 await page.locator('#purchase-form').getByRole('button',{name:'Start new scenario',exact:true}).click();
 await ready(page,'[data-action=attempt-qr]');
 const sim=new URL(page.url()).searchParams.get('simulation');check(sim,'Exact simulation in URL');
 await click(page,'Pay by QR');await ready(page,'#cash-form');
 check((await page.locator('#phone-content').innerText()).includes('failed on screen'),'Phone shows failed result separately');
 await click(page,'Pay cash and get receipt');await ready(page,'[data-action=observe-debit]');
 check(await page.locator('.qr-phone-receipt img').count()===1,'Receipt issued before later debit');
 await click(page,'View later bank activity');await ready(page,'[data-action=attach-sample-receipt]');
 if(upload){
  const receipt=await page.evaluate(()=>S.sim.issued_receipt);
  await page.getByText('Upload your own receipt',{exact:true}).click();
  await page.locator('#receipt-draft-form input[type=file]').setInputFiles({name:'customer-receipt.png',mimeType:'image/png',buffer:Buffer.from(receipt.base64,'base64')});
  await page.locator('#receipt-draft-form textarea').fill(receipt.transcript);
  await page.locator('#receipt-draft-form button[type=submit]').click();check(true,'Customer image upload submitted through the browser');
 }else await click(page,'Use sample receipt');
 await ready(page,'[data-action=report]');
 await click(page,'File complaint with receipt');await ready(page,'#report-form');
 const draft='My saved receipt complaint: cash paid after QR failure and a later debit.';
 await page.getByRole('textbox',{name:'Your complaint',exact:true}).fill(draft);
 await page.reload();await ready(page,'[data-action=report]');await click(page,'File complaint with receipt');
 check(await page.getByRole('textbox',{name:'Your complaint',exact:true}).inputValue()===draft,'Complaint draft survives refresh without submitting');
 await page.locator('#report-form button[type=submit]').click();await ready(page,'[data-check=receipt_scan]');
 await page.getByRole('link',{name:'Open operator investigation',exact:true}).click();
 check(context.pages().length===1,'Operator journey uses the same tab');
 const savedURL=page.url();const id=new URL(savedURL).searchParams.get('case');check(id,'Exact case in URL');
 await click(page,'Scan receipt');
 if(motion==='no-preference'){
  await ready(page,'.qr-scan-beam');await page.evaluate(()=>{window.receiptNode=document.querySelector('#qr-evidence .qr-reader');});await page.evaluate(()=>sync(true));check(await page.evaluate(()=>window.receiptNode===document.querySelector('#qr-evidence .qr-reader')),'Polling preserves the mounted receipt canvas');check(await page.locator('.qr-scan-beam').isVisible(),'Top-to-bottom scan animation is visible');
  await page.waitForFunction(()=>document.querySelector('.qr-scan-announcement')?.textContent.includes('Scanning'));check((await page.locator('.qr-scan-announcement').innerText()).includes('Scanning'),'Scanning field announced');
 }
 await page.getByRole('button',{name:'Verify with Marketplace',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>typeof S!=='undefined'&&!S.busy.staff);
 check(await page.locator('#qr-evidence .qr-reader img').count()===1,'Large coordinate-aligned receipt reader replaces tiny paired previews');
 const reader=page.locator('#qr-evidence .qr-reader');
 const alignment=await reader.evaluate(el=>{const a=el.querySelector('img').getBoundingClientRect(),b=el.querySelector('svg').getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1;});
 check(alignment,'Preview and overlay share exactly the same displayed coordinates');
 await reader.getByRole('button',{name:'Original',exact:true}).click();
 check(await reader.locator('.qr-region-overlay').isHidden(),'Original view preserves pixels without derived overlay');
 await reader.getByRole('button',{name:'Annotated',exact:true}).click();
 await reader.getByRole('button',{name:'View larger',exact:true}).click();
 await ready(page,'#receipt-reader-dialog[open]');
 await page.keyboard.press('+');check(await page.locator('#receipt-reader-dialog .qr-paper-canvas').evaluate(e=>e.style.width)==='125%','Keyboard zoom enlarges receipt');
 await page.keyboard.press('Escape');check(await page.locator('#receipt-reader-dialog').isHidden(),'Enlarged receipt closes with Escape');
 check(await page.getByRole('button',{name:'Verify with Marketplace',exact:true}).isDisabled(),'Verification requires explicit review acknowledgement');
 await page.locator('#receipt-review-ack').check();
 if(profile==='confirmed'){for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1050});await overflow(page,`Receipt reader width ${width}`);await page.screenshot({path:join(output,`receipt-${width}.png`),fullPage:true});}await page.setViewportSize({width:1440,height:1050});}
 check((await page.locator('.qr-fields').innerText()).includes('500.00'),'Receipt values visible with source labels');
 await click(page,'Verify with Marketplace');
 if(motion==='no-preference'){
  await ready(page,'.qr-edge.active');
  await page.waitForFunction(()=>[...document.querySelectorAll('.qr-edge.active')].some(e=>getComputedStyle(e).strokeWidth==='4px' && getComputedStyle(e).filter!=='none'));
  check(true,'Active edge is thick and glowing');
 }
 const outcome=profile==='confirmed'?'legitimate':profile==='denied'?'rejected':'uncertain';
 await page.getByRole('button',{name:`Record ${outcome} verdict`,exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-qr-verdict]')?.disabled);
 await click(page,`Record ${outcome} verdict`);
 if(outcome==='legitimate'){
  await click(page,'Approve simulated refund');await ready(page,'[data-qr-action=complete_refund]');
  check((await page.locator('#qr-outcome').innerText()).includes('REFUND REQUESTED'),'Approval is distinct from refund completion');
  await click(page,'Post simulated refund');await page.waitForFunction(()=>document.querySelector('#qr-outcome')?.textContent.includes('Simulated refund completed'));
 }else if(outcome==='uncertain'){
  await click(page,'Create human handoff');await ready(page,'#qr-outcome .qr-resolution-card.handoff');
  check((await page.locator('#qr-outcome .qr-resolution-card.handoff').innerText()).includes('Next review'),'Uncertain branch has an owned next review');
  check(await page.locator('[data-qr-action=approve_refund]').count()===0,'Uncertain branch has no refund control');
 }else{
  await ready(page,'#qr-outcome');check((await page.locator('#qr-outcome').innerText()).includes('no refund'),'Rejected branch has no refund');
 }
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await page.locator('[data-qr-node=receipt_scan]').click();check((await page.locator('.qr-board-inspector').innerText()).includes('Evidence v'),'Graph selection exposes saved provenance');
 await click(page,'Replay');await page.waitForFunction(()=>document.querySelector('.qr-board-toolbar')?.textContent.includes('SAVED EVENT REPLAY'));check(await page.locator('.qr-board-toolbar').innerText().then(v=>v.includes('SAVED EVENT REPLAY')),'Event replay is available');await click(page,'Live');
 check(await page.locator('.qr-node.completed').count()>0,'Completed nodes have a full filled state');
 await page.reload();await ready(page,'.graph--qr');
 check(new URL(page.url()).searchParams.get('simulation')===sim && new URL(page.url()).searchParams.get('case')===id,'Refresh restores exact context');
 const popupPromise=context.waitForEvent('page');await page.getByRole('link',{name:'Open companion view',exact:true}).first().click();const popup=await popupPromise;
 await ready(popup,'.graph--qr');check(new URL(popup.url()).searchParams.get('case')===id,'Companion view preserves exact case');await popup.close();
 await page.getByRole('link',{name:'See customer status',exact:true}).click();
 check(new URL(page.url()).searchParams.get('view')==='customer','Customer shortcut updates canonical view URL');
 await page.goBack();await ready(page,'.graph--qr');check(new URL(page.url()).searchParams.get('view')==='operator','Back restores operator view');
 await page.goForward();await ready(page,'.qr-status-facts');check(new URL(page.url()).searchParams.get('view')==='customer','Forward restores customer view');
 await page.goto(base+'/qr-demo');await ready(page,'#purchase-form');check((await page.locator('#current-stage').innerText()).includes('Start with the purchase'),'Fresh visit starts at purchase stage');check(await page.getByRole('button',{name:/Resume saved journey/}).count()===1,'Fresh visit offers explicit resume instead of choosing a saved record');
 await page.goto(savedURL.replace('view=operator','view=both'));await ready(page,'.graph--qr');
 return {context,page,sim,id};
}
async function basketEditor(){
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/qr-demo');await ready(page,'#purchase-form');
 check(await page.locator('.qr-basket-item').count()===9,'Default purchase contains nine editable grocery items');
 check(await page.locator('.qr-basket').getAttribute('open')===null,'Basket editor starts compact instead of overwhelming the phone');
 await page.locator('.qr-basket > summary').click();
 await page.locator('#basket-price-0').fill('8.35');await page.locator('#basket-quantity-0').fill('2');await page.locator('#purchase-tax_minor').fill('1.23');
 check(await page.locator('#purchase-qr_amount_minor').inputValue()==='437.93','QR amount follows exact basket arithmetic including tax');
 await page.locator('#purchase-qr_amount_minor').fill('100.00');await page.locator('#basket-quantity-0').fill('3');
 check(await page.locator('#purchase-qr_amount_minor').inputValue()==='100.00','Explicit partial QR amount survives basket edits');
 await page.reload();await ready(page,'#purchase-form');await page.locator('.qr-basket > summary').click();
 check(await page.locator('#basket-quantity-0').inputValue()==='3'&&await page.locator('#purchase-tax_minor').inputValue()==='1.23','Basket and tax draft survive refresh without submission');
 await page.locator('[data-basket-remove="8"]').click();await page.locator('.qr-basket > summary').click();
 await page.locator('[data-basket-add]').click();await page.locator('.qr-basket > summary').click();await page.locator('#basket-description-8').fill('Tea');
 await overflow(page,'Editable basket at 390');
 await page.locator('#purchase-form button[type=submit]').click();await ready(page,'[data-action=attempt-qr]');
 check(await page.evaluate(()=>S.sim.total_minor===30728&&S.sim.tax_minor===123&&S.sim.line_items[0].line_total_minor===2505),'Server saves exact itemized purchase snapshot');
 await click(page,'Pay by QR');await ready(page,'#cash-form');await page.locator('#cash-form input[name=amount_minor]').fill('207.28');
 await click(page,'Pay cash and get receipt');await ready(page,'[data-action=observe-debit]');
 await page.getByRole('button',{name:'View receipt',exact:true}).click();await ready(page,'#receipt-reader-dialog[open]');
 check(await page.locator('#receipt-reader-dialog img').evaluate(e=>e.naturalHeight>e.naturalWidth),'Customer can read the same tall paper receipt');await page.keyboard.press('Escape');
 await click(page,'View later bank activity');await ready(page,'[data-action=attach-sample-receipt]');await click(page,'Use sample receipt');await ready(page,'[data-action=report]');
 await click(page,'File complaint with receipt');await ready(page,'#report-form');await page.locator('#report-form button[type=submit]').click();await ready(page,'[data-check=receipt_scan]');
 await page.getByRole('link',{name:'Open operator investigation',exact:true}).click();await click(page,'Scan receipt');await ready(page,'#receipt-review-ack');await page.waitForFunction(()=>!S.busy.staff);
 await page.locator('#receipt-review-ack').check();await click(page,'Verify with Marketplace');await ready(page,'[data-qr-verdict=REJECTED]');await page.waitForFunction(()=>!S.busy.staff);
 check(await page.evaluate(()=>S.staffCase.qr_pipeline.marketplace.reason_code==='NO_OVERPAYMENT'),'Valid split payment is rejected as a duplicate claim, not refunded');
 await click(page,'Record rejected verdict');check(await page.locator('[data-qr-action=approve_refund]').count()===0,'Split-payment browser journey exposes no refund control');
 await context.close();
}

try{
 const deadline=Date.now()+20000;
 while(true){try{if((await fetch(base+'/')).ok)break;}catch{} if(Date.now()>deadline)throw Error(serverErrors||'Server did not start');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.TRACEFIX_CHROME || '/opt/google/chrome/chrome',args:['--no-sandbox']});
 const homeContext=await browser.newContext({viewport:{width:1440,height:1000}}),home=await homeContext.newPage();
 await home.goto(base+'/');await ready(home,'a[href="/qr-demo"]');check(await home.locator('a[href="/qr-demo"]').count()>0,'Homepage directly exposes canonical QR journey');await homeContext.close();
 await basketEditor();
 const happy=await journey('confirmed','no-preference');
 for(const width of [320,390,768,1024,1440,1920]){
  await happy.page.setViewportSize({width,height:1050});await overflow(happy.page,`QR width ${width}`);
  await happy.page.evaluate(()=>window.scrollTo(0,0));
  await happy.page.screenshot({path:join(output,`qr-${width}.png`),fullPage:true});
  await happy.page.locator('[data-staff-tab=evidence]').click();await overflow(happy.page,`Evidence width ${width}`);
  await happy.page.locator('[data-staff-tab=activity]').click();await overflow(happy.page,`Activity width ${width}`);
  await happy.page.locator('[data-staff-tab=overview]').click();
 }
 await happy.page.setViewportSize({width:390,height:900});
 await click(happy.page,'View all steps');await ready(happy.page,'dialog[open]');
 check((await happy.page.locator('dialog').innerText()).includes('Marketplace'),'Mobile step drawer contains complete journey');
 await happy.page.keyboard.press('Tab');check(await happy.page.evaluate(()=>document.activeElement.closest('dialog')!==null),'Dialog traps keyboard focus');
 await happy.page.keyboard.press('Escape');
 check(await happy.page.getByRole('button',{name:'View all steps',exact:true}).evaluate(e=>document.activeElement===e),'Closing step drawer restores trigger focus');
 await click(happy.page,'Navigate workspace');await click(happy.page,'Evidence');check(new URL(happy.page.url()).searchParams.get('view')==='operator','Mobile drawer navigates to evidence');
 await happy.page.locator('[data-qr-node=receipt_scan]').focus();await happy.page.keyboard.press('Enter');check((await happy.page.locator('.qr-board-inspector').innerText()).includes('Receipt scan'),'Keyboard selects graph nodes');
 check(await happy.page.locator('[data-qr-node=receipt_scan]').evaluate(e=>document.activeElement===e),'Graph selection retains keyboard focus after rendering');
 await happy.page.locator('[data-qr-zoom="in"]').focus();await happy.page.keyboard.press('Enter');
 check(await happy.page.locator('[data-qr-zoom="in"]').evaluate(e=>document.activeElement===e),'Zoom retains keyboard focus after rendering');
 await happy.page.emulateMedia({reducedMotion:'reduce'});
 const animation=await happy.page.locator('.qr-edge.active').first().evaluate(e=>getComputedStyle(e).animationName).catch(()=>null);
 check(animation===null || animation==='none','Reduced motion disables moving graph probes');
 await happy.context.tracing.stop({path:join(output,'happy-trace.zip')});await happy.context.close();
 for(const profile of ['denied','unverified']){const flow=await journey(profile,'reduce',profile==='denied');await flow.context.tracing.stop({path:join(output,profile+'-trace.zip')});await flow.context.close();}
 const recovery=await browser.newContext();const page=await recovery.newPage();await page.goto(base+'/qr-demo?simulation=missing&case=missing');await ready(page,'#purchase-form');await ready(page,'#feedback');check((await page.locator('#feedback').innerText()).includes('unavailable'),'Unavailable exact context gives explicit recovery');await recovery.close();
 check(errors.length===0,'No browser runtime errors: '+errors.join('; '));
 writeFileSync(join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,output,results},null,2));
}catch(error){if(browser)for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:join(output,'failure-'+Date.now()+'.png'),fullPage:true}).catch(()=>{});await context.tracing.stop({path:join(output,'failure-trace.zip')}).catch(()=>{});}console.error('QR browser artifacts:',output);throw error;}finally{if(browser)await browser.close();server.kill('SIGTERM');}
