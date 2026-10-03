/* DataUkil: every visible finding comes from a saved API record. */
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = value => String(value || 'Unknown').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const money = n => n === null || n === undefined ? 'Unknown' : '৳'+(n/100).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
const date = t => t ? new Date(t).toLocaleString('en-GB',{timeZone:'Asia/Dhaka',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' BDT' : 'Not recorded';
const short = id => id ? id.slice(0,7)+'…'+id.slice(-6) : '—';
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const newKey = () => crypto.randomUUID();
const params = new URLSearchParams(location.search);
const caseMatch = location.pathname.match(/^\/operations\/cases\/([^/]+)(\/studio)?/);
const S = {
  page:location.pathname==='/customer'?'customer':caseMatch?(caseMatch[2]?'studio':'case'):'operations',
  role:location.pathname==='/customer'?'customer':localStorage.getItem('tf.operator') || 'staff',
  caseId:caseMatch?.[1], tokens:JSON.parse(sessionStorage.getItem('tf.consoleTokens') || '{}'),
  lang:localStorage.getItem('tf.language') || 'en', txId:params.get('transaction') || localStorage.getItem('tf.currentTransfer'),
  case:null, tx:null, run:null, runs:[], transactions:[], cases:[], scenarios:[], overview:null,
  tab:'overview', drafts:{}, busy:false, auto:false, selectedPhase:null, selectedEvent:null,
  zoom:1, panX:0, panY:0, follow:true, expanded:true, replay:false, replayCursor:0, replayPaused:true,
  speed:1, replayTimer:null, abort:null, streamId:null, pollTimer:null, modal:null, filter:'unresolved', search:'', dialogSubmit:null,
  analysisMode:params.get('mode') || 'live', presentationPaused:false, presentationCursor:0
};
const BN = {
 'Customer dashboard':'গ্রাহক ড্যাশবোর্ড','Operations center':'অপারেশনস কেন্দ্র','QR + cash demo lab':'QR + নগদ ডেমো','Add-money walkthrough':'টাকা যোগ করার ডেমো',
 'Synthetic environment':'সিমুলেটেড পরিবেশ','Refresh':'রিফ্রেশ','Your payments, clearly explained.':'আপনার লেনদেনের প্রতিটি ধাপ দেখুন।',
 'Send a bank → upay transfer':'ব্যাংক → উপায় ট্রান্সফার করুন','New synthetic transfer':'নতুন সিমুলেটেড ট্রান্সফার',
 'Demo customer name':'ডেমো গ্রাহকের নাম','Amount (BDT)':'পরিমাণ (টাকা)','Demo scenario':'ডেমো পরিস্থিতি',
 'Create transfer':'ট্রান্সফার শুরু করুন','Saved transfers':'সংরক্ষিত ট্রান্সফার','Current payment':'বর্তমান লেনদেন',
 'Payment state':'লেনদেনের অবস্থা','Run payment stages':'লেনদেনের ধাপ চালান','Advance one stage':'পরবর্তী ধাপ',
 'Check late confirmation':'বিলম্বিত নিশ্চিতকরণ দেখুন','Pause simulation':'সিমুলেশন থামান','Report an issue':'অভিযোগ জানান',
 'Track your case':'আপনার অভিযোগের অবস্থা','Your saved cases':'আপনার সংরক্ষিত অভিযোগ','Confirmed facts':'যাচাইকৃত তথ্য',
 'Next action':'পরবর্তী পদক্ষেপ','Assigned operator':'দায়িত্বপ্রাপ্ত অপারেটর','Next review':'পরবর্তী পর্যালোচনা',
 'Verified update':'যাচাইকৃত আপডেট','Conversation':'বার্তা','Your evidence':'আপনার প্রমাণ','Add evidence':'প্রমাণ যোগ করুন',
 'Send':'পাঠান','Message your operator…':'অপারেটরকে বার্তা লিখুন…','Evidence request':'প্রমাণের অনুরোধ',
 'Reply to request':'অনুরোধের উত্তর দিন','Stuck Transfer':'আটকে থাকা ট্রান্সফার','Paid Twice':'দুইবার টাকা প্রদান',
 'Issue type':'সমস্যার ধরন','What happened?':'কী ঘটেছে?','Save complaint':'অভিযোগ সংরক্ষণ করুন',
 'Evidence text':'প্রমাণের বিবরণ','Receipt or document':'রসিদ বা নথি','Human transcript for images':'ছবির লেখা নিজে লিখুন',
 'Save evidence':'প্রমাণ সংরক্ষণ করুন','Cancel':'বাতিল','Synthetic balances':'সিমুলেটেড ব্যালেন্স',
 'Bank balance':'ব্যাংক ব্যালেন্স','Wallet balance':'ওয়ালেট ব্যালেন্স','Evidence needed':'প্রমাণ প্রয়োজন',
 'No transfer selected':'কোনো ট্রান্সফার নির্বাচন করা হয়নি','No cases yet':'এখনও কোনো অভিযোগ নেই',
 'Customer → Gateway → Bank/Partner → Queue → Response → Settlement → Wallet':'গ্রাহক → গেটওয়ে → ব্যাংক/পার্টনার → কিউ → রেসপন্স → সেটেলমেন্ট → ওয়ালেট',
 'Why this stage?':'এই ধাপের উদ্দেশ্য','What was found':'যা পাওয়া গেছে','What happens next':'পরবর্তী ধাপে যা হবে',
 'Transfer saved.':'ট্রান্সফার সংরক্ষণ হয়েছে।','Complaint saved under one incident.':'একটি ঘটনার অধীনে অভিযোগ সংরক্ষণ হয়েছে।',
 'Awaiting source verification.':'উৎসের যাচাইয়ের অপেক্ষায়।','Analysis needs an updated review.':'বিশ্লেষণের নতুন পর্যালোচনা প্রয়োজন।',
 'Processing':'প্রক্রিয়াধীন','Uncertain':'অনিশ্চিত','Succeeded':'সফল','Failed':'ব্যর্থ','Corrected':'সংশোধিত',
 'Open':'খোলা','Resolved':'সমাধান হয়েছে','Investigating':'তদন্ত চলছে','Waiting Evidence':'প্রমাণের অপেক্ষায়',
 'Repair Eligible':'সংশোধনের উপযুক্ত','Reviewed':'পর্যালোচিত','Escalated':'হস্তান্তর প্রস্তাবিত',
 'Customer':'গ্রাহক','Gateway':'গেটওয়ে','Bank / Partner':'ব্যাংক / পার্টনার','Queue':'কিউ','Response':'রেসপন্স',
 'Settlement':'সেটেলমেন্ট','Wallet':'ওয়ালেট','Completed':'সম্পন্ন','Failure':'ব্যর্থতা','Attention':'পর্যালোচনা দরকার','Unknown':'অজানা',
 'Success':'সফল ট্রান্সফার','Delayed response':'বিলম্বিত রেসপন্স','Stuck processing':'আটকে থাকা প্রক্রিয়া',
 'Confirmed failure':'নিশ্চিত ব্যর্থতা','Duplicate payment':'দ্বৈত পেমেন্ট','Missing partner response':'পার্টনারের রেসপন্স নেই',
 'Retry':'পুনরায় চেষ্টা','Settlement uncertainty':'সেটেলমেন্ট অনিশ্চিত'
};
Object.assign(BN,{
 'Send a synthetic bank-to-upay transfer, follow its processing stages and track the evidence behind every case update.':'সিমুলেটেড ব্যাংক থেকে উপায় ট্রান্সফার করুন, প্রতিটি ধাপ দেখুন এবং অভিযোগের যাচাইকৃত আপডেট পান।',
 'All accounts and money movements are fictional. Each stage saves a source event.':'সব অ্যাকাউন্ট ও টাকার লেনদেন সিমুলেটেড। প্রতিটি ধাপে উৎসের রেকর্ড সংরক্ষণ হয়।',
 'Use the form to start the ৳1,000 bank-to-upay demonstration.':'ফর্ম থেকে ৳১,০০০ ব্যাংক থেকে উপায় ট্রান্সফারের ডেমো শুরু করুন।',
 'Create a synthetic transfer to see its saved stages.':'সিমুলেটেড ট্রান্সফার তৈরি করে তার সংরক্ষিত ধাপগুলি দেখুন।',
 'Your payment stages survive refresh.':'রিফ্রেশ করলেও আপনার লেনদেনের ধাপগুলি সংরক্ষিত থাকে।',
 'Reporting a payment creates one persistent incident and one owned case.':'অভিযোগ করলে একটি ঘটনা ও একটি দায়িত্বপ্রাপ্ত মামলা সংরক্ষণ হয়।',
 'One complaint per incident.':'প্রতি ঘটনার জন্য একটি অভিযোগ।','No saved transfers':'সংরক্ষিত ট্রান্সফার নেই',
 'Investigation progress':'তদন্তের অগ্রগতি','Not Started':'শুরু হয়নি','Decision':'অপারেটরের সিদ্ধান্ত','Not Run':'বিশ্লেষণ হয়নি',
 'Verified update history':'যাচাইকৃত আপডেটের ইতিহাস','Saved payment timeline':'সংরক্ষিত লেনদেনের সময়রেখা',
 'Customer initiated':'গ্রাহকের সূচনা','MFS gateway':'MFS গেটওয়ে','Bank / partner':'ব্যাংক / পার্টনার','Processing queue':'প্রসেসিং কিউ','upay wallet':'উপায় ওয়ালেট',
 'Successful transfer':'সফল ট্রান্সফার','Verified duplicate · repair ending':'নিশ্চিত দ্বৈত ডেবিট · সংশোধন',
 'Missing response · handoff ending':'রেসপন্স নেই · হস্তান্তর','Retry with one payment':'পুনরায় চেষ্টা · একটি পেমেন্ট',
 'Identify the intended amount, source account and destination wallet.':'নির্ধারিত পরিমাণ, উৎস ব্যাংক অ্যাকাউন্ট ও গন্তব্য ওয়ালেট শনাক্ত করা।',
 'Accept the request and assign one correlation identity.':'অনুরোধ গ্রহণ করে একটি নির্দিষ্ট পরিচয় নির্ধারণ করা।',
 'Record the bank debit under the exact transfer reference.':'নির্দিষ্ট ট্রান্সফার রেফারেন্সে ব্যাংক ডেবিটের রেকর্ড রাখা।',
 'Track queued processing and retry attempts without assuming another payment.':'কিউ এবং পুনরায় অনুরোধ যাচাই করা। পুনরায় অনুরোধ মানেই আরেকটি পেমেন্ট নয়।',
 'Check whether the partner returned a verified outcome.':'পার্টনার যাচাইকৃত ফলাফল দিয়েছে কি না দেখা।',
 'Reconcile the bank posting with final settlement.':'ব্যাংকের ডেবিটের সঙ্গে চূড়ান্ত সেটেলমেন্ট মেলানো।',
 'Confirm the intended wallet credit or retain the unresolved outcome.':'নির্ধারিত ওয়ালেট ক্রেডিট নিশ্চিত করা অথবা অনিশ্চিত ফলাফল বজায় রাখা।',
 'Gateway request accepted and exact transaction reference matched.':'গেটওয়ে অনুরোধ গ্রহণ করেছে এবং নির্দিষ্ট ট্রান্সফার রেফারেন্স মিলেছে।',
 'Retry request recorded under the same transaction.':'একই ট্রান্সফারের অধীনে পুনরায় অনুরোধের রেকর্ড আছে।',
 'Transfer entered the processing queue.':'ট্রান্সফার প্রসেসিং কিউতে প্রবেশ করেছে।',
 'Final partner response is not available. This does not establish a failed or duplicate settlement.':'পার্টনারের চূড়ান্ত রেসপন্স নেই। এই তথ্য ব্যর্থ বা দ্বৈত সেটেলমেন্ট প্রমাণ করে না।',
 'Partner response accepted the exact transfer reference.':'পার্টনার নির্দিষ্ট ট্রান্সফার রেফারেন্স গ্রহণ করেছে।',
 'One intended settlement is confirmed for this transfer.':'এই ট্রান্সফারের একটি নির্ধারিত সেটেলমেন্ট নিশ্চিত হয়েছে।',
 'The partner confirms an unsettled debit and explicitly permits one idempotent settlement retry.':'পার্টনার একটি অসম্পন্ন ডেবিট নিশ্চিত করেছে এবং একবার নিরাপদে সেটেলমেন্টের পুনরায় চেষ্টা অনুমোদন করেছে।',
 'Partner final rejection confirms that no wallet settlement was made.':'পার্টনারের চূড়ান্ত প্রত্যাখ্যান নিশ্চিত করেছে যে ওয়ালেটে সেটেলমেন্ট হয়নি।',
 'Final settlement is not confirmed by the available records.':'উপলব্ধ রেকর্ডে চূড়ান্ত সেটেলমেন্ট নিশ্চিত হয়নি।',
 'The complete sandbox wallet query confirms no credit for this reference.':'পূর্ণ সিমুলেটেড ওয়ালেট অনুসন্ধানে এই রেফারেন্সে কোনো ক্রেডিট হয়নি বলে নিশ্চিত হয়েছে।',
 'Wallet completion remains unknown; further verification is required.':'ওয়ালেটে ক্রেডিট হয়েছে কি না এখনও অজানা। আরও যাচাই প্রয়োজন।',
 'The bank posting inventory for this exact reference is complete as of this recorded check.':'এই রেফারেন্সের সব ব্যাংক পোস্টিং এই অনুসন্ধানে যাচাই হয়েছে।',
 'A delayed matching partner confirmation has now arrived.':'মিলে যাওয়া বিলম্বিত পার্টনার নিশ্চিতকরণ এখন এসেছে।',
 'Late final settlement confirms one successful transfer.':'বিলম্বিত চূড়ান্ত সেটেলমেন্ট একটি সফল ট্রান্সফার নিশ্চিত করেছে।',
 'The delayed transfer is now credited once to the wallet.':'বিলম্বিত ট্রান্সফারটি এখন ওয়ালেটে একবার ক্রেডিট হয়েছে।',
 'Track the verified case update below.':'নিচে অভিযোগের যাচাইকৃত আপডেট দেখুন।',
 'Report the issue if the payment needs investigation.':'লেনদেনের তদন্ত প্রয়োজন হলে অভিযোগ জানান।',
 'Check the saved late partner and wallet confirmations.':'সংরক্ষিত বিলম্বিত পার্টনার ও ওয়ালেট নিশ্চিতকরণ দেখুন।',
 'The assigned investigator will review the saved evidence.':'দায়িত্বপ্রাপ্ত অপারেটর সংরক্ষিত প্রমাণ পর্যালোচনা করবেন।',
 'Partner explicitly rejected the transfer after debit. A return of the unsettled debit is authorized in the sandbox contract.':'ডেবিটের পরে পার্টনার ট্রান্সফার প্রত্যাখ্যান করেছে। সিমুলেটেড চুক্তি অনুযায়ী অসম্পন্ন ডেবিট ফেরত দেওয়ার অনুমতি আছে।',
 'CONFIRMED SYSTEM RECORD':'যাচাইকৃত সিস্টেম রেকর্ড'
});
Object.assign(BN,{'Merchant information (optional)':'মার্চেন্টের তথ্য (ঐচ্ছিক)','Approximate time (optional, Bangladesh time)':'আনুমানিক সময় (ঐচ্ছিক, বাংলাদেশ সময়)',
 'Supporting evidence (optional)':'সহায়ক প্রমাণ (ঐচ্ছিক)','Original receipt (optional)':'আসল রসিদ (ঐচ্ছিক)',
 'The verified outcome is recorded. You can send further evidence for another review.':'যাচাইকৃত ফলাফল সংরক্ষণ হয়েছে। নতুন পর্যালোচনার জন্য আপনি আরও প্রমাণ দিতে পারেন।'});
function customerText(text) {
  if(S.page!=='customer'||S.lang!=='bn')return text;
  const translated=tr(text);if(translated!==text)return translated;
  const amount=String(text).match(/BDT (\d+(?:\.\d+)?)/)?.[1];
  if(text.startsWith('Simulated bank-to-upay transfer'))return 'সিমুলেটেড ব্যাংক থেকে উপায় ট্রান্সফার '+amount+' টাকা শুরু হয়েছে।';
  if(text.startsWith('Bank posting ')&&amount)return 'ব্যাংকের নির্দিষ্ট পোস্টিং '+amount+' টাকা ডেবিট নিশ্চিত করেছে।';
  if(text.startsWith('A second confirmed bank debit')&&amount)return 'একই ট্রান্সফারে দ্বিতীয় নিশ্চিত ব্যাংক ডেবিট '+amount+' টাকা পোস্ট হয়েছে।';
  if(text.startsWith('Wallet posting ')&&amount)return 'ওয়ালেটের নির্দিষ্ট পোস্টিং একবার '+amount+' টাকা ক্রেডিট নিশ্চিত করেছে।';
  return translated;
}
const tr = text => S.page==='customer' && S.lang==='bn' ? BN[text] || text : text;
const tone = state => /RESOLVED|OUTCOME_RECORDED|SUCCEEDED|CORRECTED|COMPLETED|SUPPORTED|CURRENT/.test(state||'') && !/UNSUPPORTED|NOT_SUPPORTED/.test(state||'') ? 'green' : /FAILED|CONFLICT|failure/.test(state||'')?'red':/WAIT|UNCERTAIN|INCONCLUSIVE|UNRESOLVED|STALE|INTERRUPTED|attention|HANDOFF|ESCALAT/.test(state||'')?'amber':/RUNNING|INVESTIGATING|ELIGIBLE|REVIEWED|active/.test(state||'')?'blue':'';
const badge = (state,text) => '<span class="badge '+tone(state)+'"><i class="dot"></i>'+esc(tr(text || label(state)))+'</span>';
const button = (action,text,kind='secondary',data='',disabled=false) => '<button type="button" class="button '+kind+'" data-action="'+action+'" '+data+(disabled?' disabled':'')+'>'+esc(tr(text))+'</button>';
const empty = (title,text) => '<div class="empty"><div class="empty-icon">◇</div><h3>'+esc(tr(title))+'</h3><p>'+esc(tr(text))+'</p></div>';
const heading = (eyebrow,title,description,actions='') => '<div class="page-heading"><div><p class="eyebrow">'+esc(eyebrow)+'</p><h1>'+esc(tr(title))+'</h1><p>'+esc(tr(description))+'</p></div><div class="heading-actions">'+actions+'</div></div>';
const card = (title,body,extra='') => '<section class="card"><div class="card-header"><h2>'+esc(tr(title))+'</h2>'+extra+'</div>'+body+'</section>';
const field = (name,title,value='',type='text',hint='') => '<label class="field"><span>'+esc(tr(title))+'</span>'+(type==='textarea'?'<textarea name="'+name+'" rows="3" required maxlength="4000">'+esc(value)+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(type==='number'?'min="0.01" max="1000000" step=".01"':'maxlength="100"')+' required>')+'</label>'+(hint?'<p class="field-hint">'+esc(tr(hint))+'</p>':'');
const select = (name,title,options,value) => '<label class="field"><span>'+esc(tr(title))+'</span><select name="'+name+'">'+options.map(o=>'<option value="'+esc(o[0])+'" '+(o[0]===value?'selected':'')+'>'+esc(tr(o[1]))+'</option>').join('')+'</select></label>';
function toast(text,error=false) {
  const el=$('#feedback'); el.textContent=tr(text); el.className='toast'+(error?' error':''); el.hidden=false;
  clearTimeout(S.toastTimer); S.toastTimer=setTimeout(()=>el.hidden=true,error?9500:5000);
}
async function session(role=S.role,renew=false) {
  if(S.tokens[role] && !renew)return S.tokens[role];
  const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
  if(!r.ok)throw Error('Unable to create a local demo session.');
  S.tokens[role]=(await r.json()).token;sessionStorage.setItem('tf.consoleTokens',JSON.stringify(S.tokens));return S.tokens[role];
}
async function api(path,options={},again=false) {
  const token=await session();
  const r=await fetch(path,{...options,headers:{'X-TraceFix-Session':token,...options.headers}});
  if(r.status===401 && !again){await session(S.role,true);return api(path,options,true);}
  if(!r.ok){const p=await r.json().catch(()=>({detail:r.statusText}));const e=Error(typeof p.detail==='string'?p.detail:JSON.stringify(p.detail));e.status=r.status;throw e;}
  return r.status===204?null:r.json();
}
async function write(path,payload) {
  // A lost response can be retried with the identical key and payload.
  const scope=S.role+':'+path, hash=JSON.stringify(payload), stored=JSON.parse(sessionStorage.getItem('tf.consolePending') || '{}');
  let op=stored[scope];if(!op || op.hash!==hash)op={key:newKey(),hash,payload};
  stored[scope]=op;sessionStorage.setItem('tf.consolePending',JSON.stringify(stored));
  try {
    const data=await api(path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':op.key},body:JSON.stringify(op.payload)});
    delete stored[scope];sessionStorage.setItem('tf.consolePending',JSON.stringify(stored));return data;
  } catch(e) {
    if(e.status){delete stored[scope];sessionStorage.setItem('tf.consolePending',JSON.stringify(stored));}
    throw e;
  }
}
async function caseWrite(suffix,data) { return write('/api/cases/'+S.case.id+'/'+suffix,{version:S.case.version,...data}); }
function updateShell() {
  document.body.classList.toggle('studio',S.page==='studio');
  document.documentElement.lang=S.page==='customer'&&S.lang==='bn'?'bn':'en';
  $('#language-wrap').hidden=S.page!=='customer';$('#identity-wrap').hidden=S.page==='customer';
  $('#language').value=S.lang;$('#identity').value=S.role;$('#avatar').textContent=S.page==='customer'?'C':S.role==='staff'?'O1':'O2';
  $('#breadcrumb').textContent=tr(S.page==='customer'?'Customer dashboard':S.page==='operations'?'Operations center':S.page==='studio'?'Operations / AI Investigation Studio':'Operations / Case workspace');
  const navLabels={customer:'Customer dashboard',operations:'Operations center',demo:'QR + cash demo lab',mfs:'Add-money walkthrough'};
  $$('.sidebar nav a').forEach(a=>{a.classList.toggle('active',a.dataset.nav===(S.page==='customer'?'customer':'operations'));if(navLabels[a.dataset.nav])a.lastChild.textContent=tr(navLabels[a.dataset.nav]);});
  $('#refresh-page').textContent='↻ '+tr('Refresh');$('.top-status').lastChild.textContent=' '+tr('Synthetic environment');
}
async function refresh(render=true) {
  if(S.page==='customer') {
    [S.transactions,S.cases,S.scenarios]=await Promise.all([api('/api/transactions'),api('/api/cases'),api('/api/scenarios').then(r=>r.scenarios)]);
    S.tx=S.transactions.find(t=>t.id===S.txId) || S.transactions[0] || null;S.txId=S.tx?.id;
    if(S.txId)localStorage.setItem('tf.currentTransfer',S.txId);
    const id=S.selectedCustomerCase || S.tx?.case_id || (!S.tx?S.cases[0]?.id:null);
    S.case=id?await api('/api/cases/'+id):null;
  } else if(S.page==='operations') [S.overview,S.transactions]=await Promise.all([api('/api/operations/overview'),api('/api/transactions')]);
  else {
    [S.case,S.runs]=await Promise.all([api('/api/cases/'+S.caseId),api('/api/cases/'+S.caseId+'/investigations')]);
    S.tx=S.case.transaction_id?await api('/api/transactions/'+S.case.transaction_id):null;
    if(S.page==='studio' && S.run)S.run=await api('/api/investigations/'+S.run.id);
  }
  $('#sync-status').textContent='Saved locally · '+date(new Date().toISOString());
  if(render)renderPage();
}
function renderPage() {
  const content=$('#content'), focused=document.activeElement;
  const focusName=content.contains(focused)?focused?.name:null, start=focused?.selectionStart,end=focused?.selectionEnd;
  const stream=$('.event-stream'),streamScroll=stream?.scrollTop,conversation=$('.conversation'),conversationScroll=conversation?.scrollTop;
  content.innerHTML=S.page==='customer'?customerPage():S.page==='operations'?overviewPage():S.page==='case'?casePage():studioPage();
  if(focusName){const el=$('[name="'+CSS.escape(focusName)+'"]',content);if(el){el.focus({preventScroll:true});try{el.setSelectionRange(start,end);}catch{ /* select has no caret */ }}}
  if(streamScroll!==undefined && $('.event-stream'))$('.event-stream').scrollTop=streamScroll;
  if(conversationScroll!==undefined && $('.conversation'))$('.conversation').scrollTop=conversationScroll;
  wireGraph();applyGraphTransform();
}
function evidenceCategory(e,index=1) {
  if(e.kind==='customer_supplied'&&index===0)return 'Customer Statement';
  return e.category || (e.kind?.startsWith('mock_')?'Confirmed System Record':e.kind==='customer_supplied'?'Customer Evidence':'External Record');
}
function evidenceText(e) {return e.revisions?.at(-1)?.text ?? e.text ?? e.original ?? '';}
function citations(ids=[]) {return ids.map(id=>'<button type="button" class="citation" data-action="evidence" data-id="'+esc(id)+'" title="'+esc(id)+'">↗ '+esc(short(id))+'</button>').join('');}
function pipeline(t,staff=false) {
  if(!t)return empty('No transfer selected','Create a synthetic transfer to see its saved stages.');
  const nodes=t.pipeline || [];
  const widths=nodes.map((_,i)=>i*156+12);
  const following=staff&&S.page==='studio'&&S.run?.status==='RUNNING'&&!S.replay;
  const activeStage=following?{initialize:'customer',context:'customer',reconstruct:'gateway',retrieve:'bank',follow:'queue',compare:'settlement',verify:'wallet'}[visibleEvents().at(-1)?.phase]:null;
  const edges=nodes.slice(1).map((n,i)=>'<path class="edge '+(n.id===activeStage?'active':nodes[i].status==='completed'&&n.status==='completed'?'completed':'')+'" d="M '+(widths[i]+138)+' 54 L '+widths[i+1]+' 54"/>').join('');
  const retry=staff && t.events?.some(e=>e.capability==='retry_observed');
  const html=nodes.map((n,i)=>'<g class="node '+n.status+(n.id===activeStage?' investigating':'')+'" transform="translate('+widths[i]+',18)" tabindex="0" role="button" aria-label="Inspect '+esc(n.title)+'" data-action="pipeline" data-stage="'+n.id+'"><rect width="138" height="71" rx="9"/><text x="12" y="26">'+esc(tr(n.title))+'</text><text class="subtext" x="12" y="48">'+esc(tr(label(n.status)))+'</text></g>').join('');
  const mobilePositions=nodes.map((_,i)=>({x:((Math.floor(i/2)%2)?1-i%2:i%2)*166+4,y:Math.floor(i/2)*90+10}));
  const mobileEdges=nodes.slice(1).map((n,i)=>{
    const a=mobilePositions[i],b=mobilePositions[i+1],horizontal=a.y===b.y;
    const path=horizontal?'M '+(a.x+(b.x>a.x?154:0))+' '+(a.y+35)+' H '+(b.x+(b.x>a.x?0:154)):'M '+(a.x+77)+' '+(a.y+70)+' V '+b.y;
    return '<path class="edge '+(nodes[i].status==='completed'&&n.status==='completed'?'completed':'')+'" d="'+path+'"/>';
  }).join('');
  const mobileNodes=nodes.map((n,i)=>'<g class="node '+n.status+'" transform="translate('+mobilePositions[i].x+','+mobilePositions[i].y+')" tabindex="0" role="button" aria-label="Inspect '+esc(n.title)+'" data-action="pipeline" data-stage="'+n.id+'"><rect width="154" height="70" rx="9"/><text x="10" y="26">'+esc(tr(n.title))+'</text><text class="subtext" x="10" y="49">'+esc(tr(label(n.status)))+'</text></g>').join('');
  return '<svg class="payment-svg payment-desktop" viewBox="0 0 1106 '+(retry?156:110)+'" role="group" aria-label="Payment processing pipeline">'+edges+html+(retry?'<path class="edge active" d="M 561 92 V 130 H 395 V 92"/><text class="subtext" x="427" y="148">Observed retry · same logical transfer</text>':'')+'</svg><svg class="payment-svg payment-mobile" viewBox="0 0 324 '+(Math.ceil(nodes.length/2)*90)+'" role="group" aria-label="Payment processing pipeline">'+mobileEdges+mobileNodes+'</svg><div class="graph-legend">'+['completed','attention','failure','unknown'].map(s=>'<span><i class="legend-dot '+({completed:'green',attention:'amber',failure:'red',unknown:'gray'}[s])+'"></i>'+esc(tr(label(s)))+'</span>').join('')+'</div>';
}
function transferForm() {
  const scenario=S.drafts.scenario || params.get('scenario') || 'duplicate_payment';
  return '<form data-form="transfer">'+field('customer_name','Demo customer name',S.drafts.customer_name || 'Farhan Demo')+
    field('amount','Amount (BDT)',S.drafts.amount || '1000','number')+
    '<div class="preset-row">'+[500,1000,2500].map(n=>button('preset','৳'+n,'small secondary','data-amount="'+n+'"')).join('')+'</div>'+
    select('scenario','Demo scenario',S.scenarios.map(x=>[x.id,x.title]),scenario)+
    '<p class="field-hint">'+esc(tr('All accounts and money movements are fictional. Each stage saves a source event.'))+'</p>'+
    '<button class="button primary full" type="submit" '+(S.busy?'disabled':'')+'>'+esc(tr('Create transfer'))+' ↗</button></form>';
}
function customerPayment() {
  const t=S.tx;
  if(!t)return empty('No transfer selected','Use the form to start the ৳1,000 bank-to-upay demonstration.');
  const current=t.pipeline.find(n=>n.id===t.current_stage),last=t.timeline.filter(e=>e.stage===t.current_stage).at(-1);
  const next=t.step<6?t.pipeline[t.step+1]?.purpose:t.can_advance?'Check the saved late partner and wallet confirmations.':t.case_id?'Track the verified case update below.':'Report the issue if the payment needs investigation.';
  return '<div class="card-header"><div><p class="eyebrow">'+esc(short(t.id))+'</p><h2>'+esc(tr('Current payment'))+'</h2></div>'+badge(t.state)+'</div>'+
    '<div class="amount-display">'+money(t.amount_minor)+'</div>'+
    '<div class="info-grid"><div><small>FROM</small><strong>'+esc(t.source_account)+'</strong></div><div><small>TO UPAY</small><strong>'+esc(t.destination_wallet)+'</strong></div><div><small>STARTED</small><strong>'+date(t.initiated_at)+'</strong></div></div>'+
    pipeline(t)+
    paymentStage(t,current,last,next)+
    '<div class="heading-actions">'+(t.can_advance?(S.auto?button('pause-auto','Pause simulation'):button('auto-payment',t.step===6?'Check late confirmation':'Run payment stages','primary'))+button('advance','Advance one stage','secondary','',S.auto):'')+
    (t.step>=2?button('complaint',t.case_id?'Track your case':'Report an issue','secondary'):'')+'</div>'+
    '<div class="info-grid"><div><small>'+esc(tr('Bank balance'))+'</small><strong>'+money(t.balances.BANK)+'</strong></div><div><small>'+esc(tr('Wallet balance'))+'</small><strong>'+money(t.balances.WALLET)+'</strong></div><div><small>'+esc(tr('Synthetic balances'))+'</small><strong>BDT · Sandbox</strong></div></div>'+
    '<details class="record-details"><summary>'+esc(tr('Saved payment timeline'))+' ('+t.timeline.length+')</summary><ul class="timeline">'+t.timeline.map(e=>'<li><time>'+date(e.timestamp)+'</time><p>'+esc(customerText(e.text))+'</p></li>').join('')+'</ul></details>';
}
function paymentStage(t,current,last,next) {
  const running=S.auto && t.can_advance;
  const finished=['SUCCEEDED','CORRECTED'].includes(t.state);
  const mode=running?'running':finished?'complete':t.can_advance?'paused':'attention';
  const stateText=running?'Simulation running':finished?'Confirmed outcome':t.can_advance?'Simulation paused':'Awaiting verification';
  const stages=t.pipeline.map((n,i)=>'<span class="stage-tick '+esc(n.status)+(n.id===t.current_stage?' current':'')+'" title="'+esc(tr(n.title)+': '+tr(label(n.status)))+'"><span>'+(n.status==='completed'?'✓':i+1)+'</span></span>').join('');
  return '<section class="stage-callout stage-'+mode+'" aria-label="'+esc(tr('Payment stage activity'))+'">'+
    '<div class="stage-head"><span class="stage-live"><i></i>'+esc(tr(stateText))+'</span><span>'+esc(tr('Stage'))+' '+(t.step+1)+' / '+t.pipeline.length+'</span></div>'+
    '<div class="stage-motion" aria-hidden="true"><span class="stage-endpoint">▤</span><span class="stage-wire"><i></i></span><span class="stage-core">'+(finished?'✓':running?'↗':'◈')+'</span><span class="stage-wire"><i></i></span><span class="stage-endpoint">▣</span></div>'+
    '<h3>'+esc(tr(current?.title || 'Customer'))+'</h3><div class="stage-track" aria-label="'+esc(tr('Saved stage progress'))+'">'+stages+'</div>'+
    '<div class="stage-explanation"><div><small>'+esc(tr('Why this stage?'))+'</small><p>'+esc(customerText(current?.purpose))+'</p></div><div><small>'+esc(tr('What was found'))+'</small><p>'+esc(customerText(last?.text))+'</p></div><div><small>'+esc(tr('What happens next'))+'</small><p>'+esc(tr(next))+'</p></div></div>'+
    '<div class="stage-receipt"><span>↳ '+t.timeline.length+' '+esc(tr('Saved events'))+'</span><time>'+date(last?.timestamp)+'</time></div></section>';
}
function conversation(c,customer=false) {
  return '<div class="conversation">'+(c.messages || []).map(m=>'<div class="message '+((customer&&m.role==='customer')||(!customer&&m.actor===(S.role==='staff'?'staff_1':'staff_2'))?'mine':'')+'"><small>'+esc(m.role==='customer'?'Customer':label(m.actor))+'</small><p>'+esc(m.text)+'</p><time>'+date(m.at)+'</time></div>').join('')+'</div><form data-form="message" class="composer"><textarea name="message" rows="2" placeholder="'+esc(tr('Message your operator…'))+'" required maxlength="4000">'+esc(S.drafts.message || '')+'</textarea><button class="button primary" type="submit">'+esc(tr('Send'))+'</button></form>';
}
function customerCase() {
  const c=S.case;
  if(!c)return empty('No cases yet','Reporting a payment creates one persistent incident and one owned case.');
  const u=c.last_verified_update;
  return '<div class="card-header"><div><p class="eyebrow">'+esc(c.reference)+'</p><h2>'+esc(tr('Track your case'))+'</h2></div>'+badge(c.status)+'</div>'+
    '<div class="info-grid"><div><small>'+esc(tr('Assigned operator'))+'</small><strong>'+esc(label(c.owner))+'</strong></div><div><small>'+esc(tr('Next review'))+'</small><strong>'+(['RESOLVED','OUTCOME_RECORDED'].includes(c.status)?esc(tr('Verified outcome')):date(c.next_review))+'</strong></div><div><small>'+esc(tr('Investigation progress'))+'</small><strong>'+esc(tr(label(c.investigation_stage)))+'</strong></div></div>'+
    '<div class="banner '+(c.status==='RESOLVED'?'green':!c.analysis_fresh?'amber':'')+'"><strong>'+esc(tr('Verified update'))+'</strong><br>'+esc(u?(S.lang==='bn'?u.text_bn:u.text):(c.assessment?.headline || tr('Awaiting source verification.')))+
    (c.analysis_state==='STALE'?'<br>'+esc(tr('Analysis needs an updated review.')):'')+'</div>'+
    '<h3>'+esc(tr('Confirmed facts'))+'</h3><div class="fact-list">'+(S.lang==='bn'&&c.confirmed_facts_bn?c.confirmed_facts_bn:c.confirmed_facts).map(f=>'<p><span class="fact-label">'+esc(tr('CONFIRMED SYSTEM RECORD'))+'</span>'+esc(f)+'</p>').join('')+'</div>'+
    (c.unresolved.length?'<div class="banner amber"><strong>'+esc(tr('Evidence needed'))+'</strong><ul>'+(S.lang==='bn'&&c.unresolved_bn?c.unresolved_bn:c.unresolved).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+
    '<p class="field-hint">'+esc(tr('Next action'))+': '+esc(tr(c.next_step))+'</p>'+
    (c.requests || []).filter(t=>t.status!=='RESOLVED').map(t=>'<div class="task-row">'+badge(t.status)+' <strong>'+esc(tr('Evidence request'))+'</strong><p>'+esc(t.question)+'</p>'+button('reply-task','Reply to request','small secondary','data-id="'+t.id+'"',t.status!=='OPEN')+'</div>').join('')+
    '<div class="card-header"><h3>'+esc(tr('Your evidence'))+'</h3>'+button('upload','Add evidence','small secondary')+'</div>'+
    '<div class="evidence-list">'+(c.evidence_receipts || []).map(e=>'<button class="evidence-row" type="button" data-action="customer-evidence" data-id="'+e.id+'"><div><strong>'+esc(e.category || 'Customer Evidence')+'</strong><p>'+esc(e.text)+'</p><small>'+date(e.at)+'</small></div><span>↗</span></button>').join('')+'</div>'+
    '<h3 class="section-spacer">'+esc(tr('Conversation'))+'</h3>'+conversation(c,true)+
    '<details class="record-details"><summary>'+esc(tr('Verified update history'))+'</summary><ul class="timeline">'+c.notifications.slice().reverse().map(n=>'<li><time>'+date(n.at)+'</time><p>'+esc(S.lang==='bn'?n.text_bn:n.text)+'</p></li>').join('')+'</ul></details>';
}
function customerPage() {
  return '<section class="customer-hero"><div><p class="eyebrow">DataUkil / CUSTOMER WORKSPACE</p><h1>'+esc(tr('Your payments, clearly explained.'))+'</h1><p>'+esc(tr('Send a synthetic bank-to-upay transfer, follow its processing stages and track the evidence behind every case update.'))+'</p></div><div class="hero-mark">↗</div></section>'+
    '<div class="grid-two"><div class="stack"><section class="card">'+customerPayment()+'</section><section class="card">'+customerCase()+'</section></div><div class="stack">'+
    card('New synthetic transfer',transferForm())+
    card('Saved transfers',S.transactions.length?S.transactions.slice(0,10).map(t=>'<button class="list-button '+(S.tx?.id===t.id?'selected':'')+'" data-action="select-transfer" data-id="'+t.id+'"><div><strong>'+money(t.amount_minor)+' · Bank → upay</strong><small>'+esc(short(t.id))+' · '+date(t.initiated_at)+'</small></div>'+badge(t.state)+'</button>').join(''):empty('No saved transfers','Your payment stages survive refresh.'))+
    card('Your saved cases',S.cases.length?S.cases.slice(0,10).map(c=>'<button class="list-button" data-action="select-case" data-id="'+c.id+'"><div><strong>'+esc(c.reference)+'</strong><small>'+esc(tr(label(c.issue_type)))+'</small></div>'+badge(c.status)+'</button>').join(''):empty('No cases yet','One complaint per incident.'))+'</div></div>';
}
function age(seconds) {return seconds<60?seconds+'s':seconds<3600?Math.floor(seconds/60)+'m':seconds<86400?Math.floor(seconds/3600)+'h':Math.floor(seconds/86400)+'d';}
function queueRows() {
  const rows=S.overview.cases.filter(c=>(S.filter==='all'||S.filter==='unresolved'&&!['RESOLVED','OUTCOME_RECORDED'].includes(c.status)||c.status===S.filter)&&
    [c.reference,c.transaction_id,c.customer,c.owner,c.issue_type].join(' ').toLowerCase().includes(S.search.toLowerCase()));
  return rows.length?rows.map(c=>'<tr><td><a class="case-link" href="/operations/cases/'+c.id+'">'+esc(c.reference)+'</a><small class="block mono">'+esc(short(c.transaction_id))+'</small></td><td><strong>'+esc(label(c.issue_type))+'</strong><small>'+esc(c.customer)+'</small></td><td>'+money(c.amount_minor)+'</td><td>'+badge(c.status)+'<small class="block">Payment: '+esc(label(c.transaction_state))+'</small><small class="block">Investigation: '+esc(label(c.investigation_status))+'</small></td><td>'+age(c.age_seconds)+'</td><td>'+badge(c.priority,c.priority)+'</td><td>'+esc(label(c.owner))+'</td><td><small>'+esc(label(c.last_event?.action))+'<br>'+date(c.last_event?.at)+'</small></td></tr>').join(''):'<tr><td colspan="8">'+empty('No matching cases','Choose another filter or start a featured scenario.')+'</td></tr>';
}
function overviewPage() {
  const o=S.overview;
  return heading('OPERATIONS / OVERVIEW','Every incident. A clear next action.','Live counts from persistent cases, investigations and eligibility checks.', '<a class="button primary" href="/customer">↗ Start a transfer</a>')+
    '<div class="metric-grid">'+[['open','Open cases',''],['investigating','Investigating',''],['awaiting_evidence','Awaiting evidence','amber'],['repair_eligible','Repair eligible','green'],['handoff','Handoff','amber'],['resolved','Resolved','green']].map(([k,t,color])=>'<div class="metric '+color+'"><small>'+t+'</small><strong>'+o.counts[k]+'</strong><div class="metric-line"><i></i></div></div>').join('')+'</div>'+
    card('Case inbox','<div class="table-tools"><input type="search" name="search" placeholder="Search case, transaction or customer" value="'+esc(S.search)+'" aria-label="Search cases"><select name="filter" aria-label="Case filter">'+[['unresolved','Unresolved cases'],['all','All cases'],['INVESTIGATING','Investigating'],['WAITING_EVIDENCE','Awaiting evidence'],['REPAIR_ELIGIBLE','Repair eligible'],['ESCALATED','Handoff'],['RESOLVED','Resolved']].map(([v,t])=>'<option value="'+v+'" '+(S.filter===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div><div class="table-wrap"><table><thead><tr><th>CASE / TRANSACTION</th><th>ISSUE / CUSTOMER</th><th>AMOUNT</th><th>STATE</th><th>AGE</th><th>PRIORITY</th><th>OWNER</th><th>LAST EVENT</th></tr></thead><tbody id="queue-rows">'+queueRows()+'</tbody></table></div>',badge('CURRENT','Persistent · server-derived'))+
    '<div class="spotlight-grid"><section class="spotlight"><p class="eyebrow">FEATURED PATH 01 / ৳1,000</p><h3>A verified duplicate, safely corrected.</h3><p>Two confirmed bank debits, one intended wallet credit. Review the cited recommendation, approve it, then execute one balanced sandbox reversal.</p><a class="button primary small" href="/customer?scenario=duplicate_payment">Start supported repair ↗</a></section><section class="spotlight"><p class="eyebrow">FEATURED PATH 02 / ৳1,000</p><h3>Uncertain evidence, accountable handoff.</h3><p>A timeout and a retry with one known debit. Missing settlement confirmation blocks repair and leads to an owned follow-up.</p><a class="button secondary small" href="/customer?scenario=missing_partner_response">Start uncertain handoff ↗</a></section></div>'+
    card('Recent synthetic transfers','<div class="table-wrap"><table><thead><tr><th>TRANSACTION</th><th>CUSTOMER</th><th>AMOUNT</th><th>PAYMENT STATE</th><th>CASE</th></tr></thead><tbody>'+S.transactions.slice(0,6).map(t=>'<tr><td class="mono">'+esc(short(t.id))+'</td><td>'+esc(t.customer_name)+'</td><td>'+money(t.amount_minor)+'</td><td>'+badge(t.state)+'</td><td>'+(t.case_id?'<a href="/operations/cases/'+t.case_id+'">Open workspace ↗</a>':'Not reported')+'</td></tr>').join('')+'</tbody></table></div>');
}
function caseHeader() {
  const c=S.case, isStudio=S.page==='studio';
  return heading('OPERATIONS / '+c.reference,isStudio?'AI Investigation Studio':label(c.issue_type || 'PAID_TWICE'),c.transaction_id || c.qr_reference || 'Unlinked incident',
    (isStudio?'<a class="button secondary" href="/operations/cases/'+c.id+'">← Case workspace</a>':'<a class="button secondary" href="/operations">← Inbox</a>')+
    '<select class="mode-select" id="analysis-mode" aria-label="Investigation mode"><option value="live" '+(S.analysisMode==='live'?'selected':'')+'>Local Qwen + guarded fallback</option><option value="demo" '+(S.analysisMode==='demo'?'selected':'')+'>Demo investigation</option></select>'+
    button('analyze',isStudio?'Restart analysis':'Analyze Case','primary','',S.replay)+
    (isStudio&&S.run?button('replay','Replay saved run','secondary','',S.run.status==='RUNNING'):''));
}
function amounts(c) {
  const f=c.facts;
  return '<div class="amount-grid">'+[['Intended amount',c.reported_amount_minor],['Checked debits / payments',f.recorded_paid_minor],['Verified returned',f.recorded_repaid_minor],['Remaining discrepancy',f.recorded_excess_minor]].map(([t,n])=>'<div><small>'+t+'</small><strong>'+money(n)+'</strong></div>').join('')+'</div>'+
    (f.remaining_unsettled_minor!==undefined?'<p class="field-hint">Unsettled amount: <strong>'+money(f.remaining_unsettled_minor)+'</strong>. Values derive from checked source records.</p>':'');
}
function staffEvidence() {
  return '<div class="evidence-list">'+S.case.evidence.map((e,i)=>'<button class="evidence-row" type="button" data-action="evidence" data-id="'+e.id+'"><span class="evidence-number">'+String(i+1).padStart(2,'0')+'</span><div>'+badge(e.kind.startsWith('mock_')?'CURRENT':'UNVERIFIED',evidenceCategory(e,i))+'<p>'+esc(evidenceText(e).slice(0,230))+'</p><div class="record-tags"><small>'+esc(e.reference || 'Supplied statement')+'</small><small>· '+date(e.event_at)+'</small><small>· Revision '+e.revisions.at(-1).version+'</small></div></div><span>↗</span></button>').join('')+'</div>';
}
function followups() {
  const c=S.case, pending=c.handoffs.find(h=>h.status==='REQUESTED');
  return card('Accountable follow-up','<div class="info-grid"><div><small>OWNER</small><strong>'+label(c.owner)+'</strong></div><div><small>PRIORITY</small><strong>'+label(c.priority||'NORMAL')+'</strong></div><div><small>NEXT REVIEW</small><strong>'+date(c.next_review)+'</strong></div></div>'+
    (pending?'<div class="banner amber"><strong>'+esc(pending.team)+'</strong><br>Requested for '+esc(label(pending.destination))+'. '+esc(pending.next_action)+'<br>Current owner remains '+esc(label(c.owner))+'.'+button('acknowledge','Acknowledge handoff','small secondary','',pending.destination!==(S.role==='staff'?'staff_1':'staff_2'))+'</div>':'')+
    '<div class="action-grid">'+button('task','Request evidence')+button('handoff','Handoff case','secondary','',!!pending)+button('schedule','Schedule review')+button('staff-evidence','Add operator evidence')+'</div>'+
    c.tasks.map(t=>'<div class="task-row">'+badge(t.status)+' '+badge('UNKNOWN',t.audience.toUpperCase())+'<p>'+esc(t.question)+'</p><small>'+esc(label(t.owner))+' · '+date(t.next_review)+'</small>'+(['OPEN','RESPONDED'].includes(t.status)?button('resolve-task','Review response','small secondary','data-id="'+t.id+'"'):'')+'</div>').join(''));
}
function trainedReadings() {
  const a=S.case.analyses?.findLast(a=>a.claims?.length) || S.case.analysis;if(!a)return '';
  return '<details class="record-details"><summary>Trained verifier: claim / passage readings · advisory</summary><p class="field-hint">Actual trained model: '+esc(a.model?.engine || 'Unavailable')+'. These text readings do not establish source authority or authorize corrections.</p>'+
    (a.claims || []).map(c=>'<h4>'+esc(c.text)+'</h4>'+c.links.slice(0,40).map(l=>'<div class="model-reading">'+citations([l.evidence_id])+' '+badge('UNKNOWN',l.learned_label || l.label)+'<p>'+esc(l.excerpt.slice(0,230))+'</p><small>'+esc(l.source_status)+'</small></div>').join('')).join('')+'</details>';
}
function casePage() {
  const c=S.case, latest=S.runs[0];
  const overview='<div class="grid-two"><div class="stack">'+card('Payment reconstruction',S.tx?pipeline(S.tx,true):'<div class="banner">QR + cash purchase · '+esc(c.purchase_id || 'Unlinked')+'. Exact source checks remain available in this workspace and the demo lab.</div>'+
    '<div class="principles"><span><strong>Payment state:</strong> '+(S.tx?esc(label(S.tx.state)):'Evidence review')+'</span><span><strong>Investigation:</strong> '+esc(latest?.status || 'Not started')+'</span><span>Checking a node records an observation.</span></div>',badge('UNKNOWN','Saved source events'))+
    card('Evidence-grounded assessment',(c.analysis_fresh?'<h3>'+esc(c.analysis.assessment.headline)+'</h3><p>'+esc(c.analysis.assessment.summary)+'</p>':'<div class="banner amber">'+(c.analysis?'New evidence invalidated the assessment. Analyze current records again.':'Launch an investigation to verify the reported issue.')+'</div>')+amounts(c)+
    '<div class="banner '+(c.facts.requirements.length?'amber':'green')+'">'+(c.facts.requirements.length?'<strong>Remaining evidence gaps</strong><ul>'+c.facts.requirements.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'The checked records cover the bounded source requirements.')+'</div>'+
    (latest?'<a class="button primary" href="/operations/cases/'+c.id+'/studio?run='+latest.id+'">Open investigation ↗</a>':button('analyze','Analyze Case','primary'))+trainedReadings())+
    card('Customer Statement','<blockquote class="statement">'+esc(c.description)+'</blockquote>'+conversation(c))+'</div><div class="stack">'+followups()+
    card('Audit exports','<p class="field-hint">The report includes reconstruction, evidence, hypotheses, decisions, repair results and unresolved issues.</p><div class="action-grid">'+button('report-md','Markdown report')+button('report-json','JSON report')+'</div>')+'</div></div>';
  const history='<div class="grid-two"><div class="stack">'+card('Case history','<ul class="timeline">'+c.audit.slice().reverse().map(e=>'<li><time>'+date(e.at)+'</time><strong>'+esc(label(e.action))+'</strong><p>'+esc(label(e.actor))+' · '+esc(e.detail || '')+'</p></li>').join('')+'</ul>')+
    card('Investigation runs',S.runs.length?S.runs.map(r=>'<a class="list-button" href="/operations/cases/'+c.id+'/studio?run='+r.id+'"><div><strong>'+esc(short(r.id))+' · '+date(r.started_at)+'</strong><small>'+esc(r.mode_label)+'</small></div>'+badge(r.status)+'</a>').join(''):empty('No investigation yet','Analyze this case to create its first durable run.'))+'</div><div class="stack">'+followups()+'</div></div>';
  return caseHeader()+'<div class="case-meta"><span>Customer <b>'+esc(c.customer_name || c.customer_id)+'</b></span><span>Case '+badge(c.status)+'</span><span>Incident <b class="mono">'+esc(short(c.incident_id))+'</b></span><span>Revision <b>'+c.version+'</b></span></div>'+
    '<div class="tabs">'+['overview','evidence','conversation','history'].map(t=>'<button type="button" class="'+(S.tab===t?'active':'')+'" data-action="case-tab" data-tab="'+t+'">'+label(t)+'</button>').join('')+'</div>'+
    (S.tab==='overview'?overview:S.tab==='evidence'?card('Evidence library',staffEvidence(),button('staff-evidence','Add evidence','small secondary')):S.tab==='conversation'?'<div class="grid-two">'+card('Customer conversation',conversation(c))+followups()+'</div>':history);
}
const PHASES=[
 ['initialize','Initialize','Identify the incident and investigation goal.'],['context','Load context','Separate allegations from confirmed source facts.'],
 ['reconstruct','Reconstruct','Match attempts to the logical transfer.'],['retrieve','Retrieve records','Find relevant sources and unavailable records.'],
 ['follow','Follow path','Locate where processing became uncertain.'],['compare','Compare evidence','Reconcile debits, settlement and wallet credit.'],
 ['verify','Verify claim','Decide what the checked evidence establishes.'],['causes','Evaluate causes','Assess supporting, contradicting and missing evidence.'],
 ['eligibility','Check eligibility','Apply independent backend authorization rules.'],['recommend','Recommend','Propose a cited next action for the operator.'],
 ['decision','Operator decision','Approve and verify a repair, or own the follow-up.']
];
function visibleEvents() {return S.run?.events?.slice(0,S.replay?S.replayCursor:S.presentationPaused?S.presentationCursor:undefined) || [];}
function activeEvent() {
  const es=visibleEvents();
  return (S.selectedEvent?es.find(e=>e.id===S.selectedEvent):null) ||
    (S.selectedPhase?es.findLast(e=>e.phase===S.selectedPhase):null) || es.at(-1);
}
const POS=[[20,25],[238,25],[456,25],[456,140],[238,140],[20,140],[20,255],[238,255],[456,255],[456,370],[238,370]];
function agentGraph() {
  const es=visibleEvents(),active=activeEvent(),latest=es.at(-1),ids=new Set(es.map(e=>e.phase));
  const nodes=PHASES.map(([id,title],i)=>{
    const ev=es.findLast(e=>e.phase===id),isActive=id===latest?.phase;
    const state=isActive&&S.run?.status==='RUNNING'&&!S.replay?'active':ev?.state==='attention'?'attention':ids.has(id)?'done':'';
    return '<g class="node '+state+'" transform="translate('+POS[i][0]+','+POS[i][1]+')" data-action="phase" data-phase="'+id+'" role="button" tabindex="0" aria-label="Inspect phase '+(i+1)+' '+esc(title)+'"><rect width="192" height="80" rx="11"/><circle cx="17" cy="24" r="4"/><text x="30" y="29">'+String(i+1).padStart(2,'0')+' / '+esc(title)+'</text>'+(S.expanded?'<text x="15" y="52" class="node-detail">'+esc(ev?ev.state==='active'?'Checking saved evidence':ev.state==='attention'?'Review needed':'Operation recorded':'Awaiting operation')+'</text><text x="15" y="68" class="node-detail">'+(ev?'Event '+ev.sequence+' · '+ev.evidence_ids.length+' citations':'No conclusion yet')+'</text>':'')+'</g>';
  }).join('');
  const edges=POS.slice(1).map((to,i)=>{
    const from=POS[i],vertical=from[0]===to[0];
    const p=vertical?'M '+(from[0]+96)+' '+(from[1]+80)+' V '+to[1]:'M '+(from[0]+(to[0]>from[0]?192:0))+' '+(from[1]+40)+' H '+(to[0]+(to[0]>from[0]?0:192));
    return '<path class="edge '+(ids.has(PHASES[i+1][0])?'done':latest?.phase===PHASES[i][0]&&S.run?.status==='RUNNING'?'active':'')+'" d="'+p+'"/>';
  }).join('');
  return '<svg class="agent-svg" id="agent-graph" viewBox="0 0 680 475" role="group" aria-label="Interactive observable investigation graph"><g id="graph-transform">'+edges+nodes+'</g></svg>';
}
function replayTransaction() {
  if(!S.replay || !S.tx || !S.run)return S.tx;
  const ids=new Set(visibleEvents().flatMap(e=>e.evidence_ids)),records=(S.run.snapshot?.evidence || []).filter(e=>e.kind==='mock_pipeline'&&ids.has(e.id)).map(e=>e.record).filter(Boolean);
  const t={...S.tx,events:records,pipeline:S.tx.pipeline.map(n=>{
    const matches=records.filter(e=>e.stage===n.id),last=matches.at(-1),failure=matches.some(e=>e.error==='DUPLICATE_POSTING');
    return {...n,status:failure?'failure':last?.status || 'unknown',event_ids:matches.map(e=>e.id),summary:last?.text || 'No source record retrieved at this replay step.'};
  })};
  return t;
}
function hypothesisCards() {
  const es=visibleEvents(), saved=es.findLast(e=>e.hypotheses)?.hypotheses || [];
  const hs=S.replay||S.presentationPaused?saved:S.run?.hypotheses?.length?S.run.hypotheses:saved;
  if(!hs.length)return '<div class="banner">Hypotheses appear as evidence is checked. Unresolved explanations remain visible.</div>';
  return '<div class="hypothesis-grid">'+hs.map(h=>'<article class="hypothesis">'+badge(h.status,h.status)+'<h3>'+esc(h.title)+'</h3><p>'+esc(h.description)+'</p>'+
    '<small>Supporting records</small>'+ (h.supporting_evidence.length?citations(h.supporting_evidence):'<small class="muted">None established.</small>')+
    '<small>Contradicting records</small>'+ (h.contradicting_evidence.length?citations(h.contradicting_evidence):'<small class="muted">None established.</small>')+
    '<small>Still needed</small>'+ (h.unresolved_evidence.length?'<p>'+esc(h.unresolved_evidence.join(' '))+'</p>':'<small>No additional record required for this scoped hypothesis.</small>')+'</article>').join('')+'</div>';
}
function studioRecommendation() {
  const r=S.run, c=S.case;
  if(!r?.recommendation || (S.replay||S.presentationPaused) && !visibleEvents().some(e=>e.phase==='recommend'))return card('Recommendation','<p class="muted">The recommendation will appear after evidence comparison and backend eligibility checks.</p>');
  const rec=r.recommendation,historical=c.current_run_id!==r.id,elig=S.replay||historical?rec:r.eligibility || rec;
  const locked=S.replay || S.presentationPaused || historical || r.status==='RUNNING',own=c.owner===(S.role==='staff'?'staff_1':'staff_2');
  const approval=S.replay?null:r.approvals?.findLast(a=>a.run_id===r.id && a.status==='APPROVED');
  const repaired=S.replay?(r.resolution&&visibleEvents().some(e=>e.phase==='decision'&&e.timestamp>=r.resolution.at)?r.resolution:null):historical?r.resolution:c.resolution || r.resolution;
  let actions='';
  if(!locked&&!repaired) {
    if(elig.eligible)actions=button('approve','Approve cited repair','primary','',!!approval||!own)+button('execute','Execute Sandbox Repair','primary','',!approval||!own)+button('reject','Reject recommendation','secondary');
    else if(rec.action==='NO_ACTION' && !c.facts.requirements.length && !c.facts.remaining_unsettled_minor && !c.facts.recorded_excess_minor)
      actions=button('no-repair','Record verified outcome','primary')+button('handoff','Handoff for review','secondary');
    else actions=button('handoff','Assign owned handoff','primary')+button('task','Request missing evidence','secondary');
  }
  return '<section class="card recommendation"><div><p class="eyebrow">EVIDENCE → POLICY → OPERATOR DECISION</p><h2>'+esc(repaired?'Verified outcome':label(rec.action))+'</h2>'+
    badge(repaired?'RESOLVED':elig.eligible?'REPAIR_ELIGIBLE':'INCONCLUSIVE',repaired?'Verified sandbox result':elig.eligible?'Eligible — operator approval required':'Repair Not Authorized')+
    '<p>'+esc(repaired?repaired.result:elig.reason || rec.reason)+'</p>'+ (rec.amount_minor?'<p>Allowlisted correction: <strong>'+money(rec.amount_minor)+'</strong></p>':'')+
    '<p><strong>Next action:</strong> '+esc(rec.next_action)+'</p><p class="field-hint">Responsible team: '+esc(elig.team || rec.team)+' · Owner: '+esc(label(c.owner))+' · Priority: '+esc(c.priority || 'NORMAL')+'</p>'+citations(rec.evidence_ids)+
    (approval?'<div class="banner green">Approved by '+esc(label(approval.actor))+': '+esc(approval.note)+'. Execution is a separate action.</div>':'')+
    (r.repair_attempts?.some(a=>a.status==='FAILED')?'<div class="banner amber">A failed attempt was recorded without financial postings. Restart and review current evidence.</div>':'')+
    (r.provider?.blocked_action?'<div class="banner amber">Model proposed '+esc(label(r.provider.blocked_action))+'. Backend rules blocked that proposal. The recommendation above follows confirmed records.</div>':'')+
    (c.handoffs?.length?'<div class="banner amber">Handoff: '+esc(c.handoffs.at(-1).team)+' · '+esc(label(c.handoffs.at(-1).status))+' · Owner '+esc(label(c.owner))+'.<br>'+esc(c.handoffs.at(-1).next_action)+'</div>':'')+'</div>'+
    '<div class="actions">'+(locked?'<div class="banner">Saved-run inspection'+(S.replay?' / replay':'')+'. Decisions require the current investigation and current evidence.</div>':actions)+
    (!locked&&!own?'<small>Use the owning operator session to approve or execute.</small>':'')+
    button('report-md','Export Markdown','secondary')+button('report-json','Export JSON','secondary')+
    (S.tx?button('reset','Reset isolated scenario','quiet','',S.replay):'')+'</div></section>';
}
function studioPage() {
  const r=S.run,es=visibleEvents(),e=activeEvent(),phase=e?.phase || 'initialize',phaseIndex=PHASES.findIndex(p=>p[0]===phase);
  const unique=new Set(es.flatMap(e=>e.evidence_ids)),historical=r && S.case.current_run_id!==r.id;
  const mode=r?.mode_label || 'Choose an investigation mode to begin.';
  const rail=PHASES.map(([id,title],i)=>{
    const seen=es.some(e=>e.phase===id),active=id===phase;
    return '<button class="phase-item '+(active?'active':seen?'done':'')+'" data-action="phase" data-phase="'+id+'"><span class="number">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(title)+'</span></button>';
  }).join('');
  const explanation='<div class="phase-explanation"><p class="eyebrow">PHASE '+(phaseIndex+1)+' / '+esc(e?.title || 'Investigator initialized')+'</p><h3>'+esc(e?.purpose || PHASES[0][2])+'</h3><div class="explanation-grid">'+
    [['WHAT IS CHECKED',e?.action || 'Waiting for an operator to start the saved investigation.'],['WHAT WAS FOUND',e?.finding || 'No findings yet.'],['WHAT CHANGED',e?.changed || 'No case or payment state changed.'],['WHAT HAPPENS NEXT',e?.next_step || 'Launch analysis to inspect the actual saved records.']].map(([t,v])=>'<div><strong>'+t+'</strong>'+esc(v)+'</div>').join('')+'</div>'+
    '<div class="record-tags">'+citations(e?.evidence_ids)+'</div></div>';
  const modeBadge='<span class="mode-label '+(r?.mode==='LIVE'?'': 'demo')+'"><i class="dot"></i>'+esc(mode)+'</span>';
  return caseHeader()+
    '<div class="studio-top">'+modeBadge+badge(r?.status || 'NOT_STARTED')+'<span class="muted">◇ Synthetic payment · '+esc(short(S.case.transaction_id || S.case.purchase_id))+'</span>'+
    (r?.status==='RUNNING'||S.presentationPaused?button('pause-view',S.presentationPaused?'Resume live view':'Pause live view','small secondary'):'')+
    '<select name="run-history" aria-label="Saved investigation runs"><option value="">Saved investigation runs</option>'+S.runs.map(run=>'<option value="'+run.id+'" '+(r?.id===run.id?'selected':'')+'>'+date(run.started_at)+' · '+run.status+'</option>').join('')+'</select></div>'+
    (historical?'<div class="banner amber">Historical investigation. The saved evidence revisions are available for replay; current decisions belong to the latest run.</div>':'')+
    (r?.status==='STALE'||r?.input_fresh===false&&!S.case.resolution?'<div class="banner amber">Source records or evidence changed. Previous recommendations and approvals cannot authorize a correction. Restart analysis.</div>':'')+
    (r?.error?'<div class="banner amber">'+esc(r.error)+'</div>':'')+
    (S.presentationPaused?'<div class="banner">Presentation paused at event '+S.presentationCursor+'. The server continues saving the actual investigation. Resume to show current saved events.</div>':'')+
    (S.replay?'<div class="replay-bar"><strong>REPLAY · SAVED EVENTS ONLY</strong><span>'+S.replayCursor+' / '+(r?.events.length || 0)+' events</span>'+button('replay-toggle',S.replayPaused?'Resume':'Pause','small secondary')+button('replay-start','From beginning','small secondary')+
      '<label>Speed <select name="replay-speed">'+[.5,1,2,4].map(n=>'<option value="'+n+'" '+(n===S.speed?'selected':'')+'>'+n+'×</option>').join('')+'</select></label>'+button('replay-exit','Exit replay','small secondary')+'<small>Source checks, model calls and repairs are disabled.</small></div>':'')+
    '<div class="studio-summary"><div><small>CURRENT FINDING</small><strong>'+esc(e?.finding || 'Investigation ready to start.')+'</strong></div><div><small>UNIQUE RECORDS CHECKED</small><strong>'+unique.size+' saved records</strong></div><div><small>EVIDENCE STRENGTH</small><strong>'+esc(S.replay&&!es.some(e=>e.phase==='verify')?'Not yet assessed':r?.strength || 'Coverage being checked')+'</strong></div></div>'+
    '<div class="studio-grid"><aside class="phase-rail"><p class="eyebrow">INVESTIGATION PHASES</p>'+rail+'</aside>'+
    '<section class="graph-card"><div class="graph-toolbar"><h3>Observable investigation graph</h3><div class="graph-tools">'+button('zoom-in','+','small secondary','aria-label="Zoom in"')+button('zoom-out','−','small secondary','aria-label="Zoom out"')+button('fit','Fit','small secondary')+button('expand',S.expanded?'Collapse':'Expand','small secondary')+
    '<label><input type="checkbox" name="follow" '+(S.follow?'checked':'')+'> Follow active</label></div></div><div class="graph-canvas">'+agentGraph()+'</div><div class="graph-caption">Click a node or event to inspect its saved operation. Drag to pan · '+Math.round(S.zoom*100)+'% zoom. Observable actions and concise findings only.</div>'+
    explanation+(S.tx?'<div class="phase-explanation"><p class="eyebrow">PAYMENT PATH / '+esc(S.replay?'HISTORICAL SOURCE SNAPSHOT':label(S.tx.state))+'</p>'+pipeline(replayTransaction(),true)+'<p class="field-hint">Payment state and investigation progress are separate. Unknown settlement remains unknown after inspection.</p></div>':'')+'</section>'+
    '<section class="event-card"><div class="event-heading"><h3>Live activity stream</h3><small>'+es.length+' saved events</small></div><div class="event-stream">'+(es.length?es.slice().reverse().map(ev=>'<button class="trace-item '+ev.state+'" data-action="event" data-id="'+ev.id+'"><time>'+String(ev.sequence).padStart(2,'0')+' / '+date(ev.timestamp)+'</time><strong>'+esc(ev.action)+'</strong><p>'+esc(ev.finding)+'</p><small>↗ '+ev.evidence_ids.length+' evidence references</small></button>').join(''):'<div class="empty"><p>Start analysis. The server will save each operation before it appears here.</p></div>')+'</div></section></div>'+
    '<div class="card-header section-spacer"><h2>Evidence & evolving hypotheses</h2>'+badge(S.replay&&!es.some(e=>e.phase==='verify')?'UNKNOWN':r?.verification || 'UNKNOWN',S.replay&&!es.some(e=>e.phase==='verify')?'Verification pending':r?.verification?.replace(/_/g,' ') || 'Verification pending')+'</div>'+hypothesisCards()+studioRecommendation();
}
function applyGraphTransform() {
  const g=$('#graph-transform');if(!g)return;
  if(S.follow && S.zoom>1){const e=visibleEvents().at(-1),i=PHASES.findIndex(p=>p[0]===e?.phase);if(i>=0){S.panX=340-(POS[i][0]+96)*S.zoom;S.panY=230-(POS[i][1]+40)*S.zoom;}}
  g.setAttribute('transform','translate('+S.panX+' '+S.panY+') scale('+S.zoom+')');
}
function wireGraph() {
  const svg=$('#agent-graph');if(!svg)return;
  let dragging=false,startX=0,startY=0,originX=0,originY=0,moved=false;
  svg.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;dragging=true;moved=false;startX=ev.clientX;startY=ev.clientY;originX=S.panX;originY=S.panY;});
  svg.addEventListener('pointermove',ev=>{
    if(!dragging)return;const scale=680/svg.getBoundingClientRect().width,dx=ev.clientX-startX,dy=ev.clientY-startY;
    if(Math.abs(dx)+Math.abs(dy)<6)return;moved=true;S.follow=false;S.panX=originX+dx*scale;S.panY=originY+dy*scale;applyGraphTransform();
    const checkbox=$('[name="follow"]');if(checkbox)checkbox.checked=false;
  });
  const stop=()=>{dragging=false;if(moved)S.suppressGraphClick=Date.now()+200;};
  svg.addEventListener('pointerup',stop);svg.addEventListener('pointerleave',stop);
}
function drawer(title,body,kicker='EVIDENCE INSPECTION') {
  const el=$('#evidence-drawer');el.hidden=false;el.innerHTML='<div class="drawer-header"><div><p class="eyebrow">'+esc(kicker)+'</p><h2>'+esc(title)+'</h2></div>'+button('close-drawer','×','icon-button','aria-label="Close evidence drawer"')+'</div>'+body;
  $('button',el)?.focus({preventScroll:true});
}
function metadata(values) {return '<dl class="metadata">'+values.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v ?? 'Not recorded')+'</dd></div>').join('')+'</dl>';}
function recordDetails(record) {
  const allowed=['id','timestamp','recorded_at','stage','status','source','correlation_id','attempt_id','retry_count','timeout','queue','error','posting_id','request','response','related_ids'];
  return '<details class="record-details" open><summary>Request, response & source records</summary><dl class="metadata">'+allowed.filter(k=>record[k]!==undefined).map(k=>'<div><dt>'+esc(label(k))+'</dt><dd class="mono">'+esc(typeof record[k]==='object'?JSON.stringify(record[k],null,2):String(record[k]))+'</dd></div>').join('')+'</dl></details>';
}
async function showEvidence(id) {
  const snapshot=S.run?.snapshot?.evidence || [],historical=S.page==='studio'&&(S.replay||S.case.current_run_id!==S.run?.id);
  const pool=historical?snapshot.concat(S.run?.resolution_evidence || []):S.case?.evidence || snapshot;
  const e=pool.find(e=>e.id===id);
  if(!e){drawer('Evidence unavailable','<div class="banner amber">This record was not part of the saved evidence revision. Refresh or inspect the historical run.</div>');return;}
  const index=pool.indexOf(e),event=activeEvent(),v=S.replay?event?.evidence_revisions?.[id]:undefined;
  const revision=v?e.revisions.find(r=>r.version===v):e.revisions.at(-1);
  const relationships=(S.run?.hypotheses || []).filter(h=>h.supporting_evidence.includes(id)||h.contradicting_evidence.includes(id));
  drawer(evidenceCategory(e,index),badge(e.kind.startsWith('mock_')?'CURRENT':'UNVERIFIED',e.reliability || (e.kind.startsWith('mock_')?'Confirmed':'User-provided'))+
    metadata([['Record ID',e.id],['Source',e.record?.source || e.supplied_by],['Timestamp',date(e.event_at)],['Received',date(e.received_at)],['Category',evidenceCategory(e,index)],['Reference',e.reference],['Relationship',e.transaction_id || e.purchase_id],['Reliability / scope',e.authority],['Evidence revision',revision?.version],['Financial amount',e.amount_minor!==null?money(e.amount_minor):'Not a posting']])+
    '<blockquote>'+esc(revision?.text || evidenceText(e))+'</blockquote><p class="field-hint">Investigation effect: '+esc(relationships.length?relationships.map(h=>h.title+': '+h.status).join('; '):'Observed within this incident. Customer assertions do not establish financial postings.')+'</p>'+
    (e.record?recordDetails(e.record):'')+
    '<details class="record-details"><summary>Saved revision history</summary>'+e.revisions.map(v=>'<p><strong>Revision '+v.version+'</strong> · '+date(v.at)+'<br>'+esc(v.reason)+'<br>'+esc(v.text)+'</p>').join('')+'</details>'+
    '<p class="hash">Original SHA-256: '+esc(e.original_hash)+'</p>'+button('original','Download original','secondary','data-id="'+id+'"')+
    (!e.kind.startsWith('mock_')&&!historical?button('correct-evidence','Correct transcript','secondary','data-id="'+id+'"'):'')+
    (e.blob?.mime?.startsWith('image/')?'<div id="original-preview"></div>':''));
  if(e.blob?.mime?.startsWith('image/'))await previewOriginal(id);
}
async function previewOriginal(id) {
  const r=await fetch('/api/evidence/'+id+'/file',{headers:{'X-TraceFix-Session':await session()}});
  if(!r.ok)return;const url=URL.createObjectURL(await r.blob()),container=$('#original-preview');
  if(container){const img=document.createElement('img');img.src=url;img.alt='Original supplied receipt for '+id;container.append(img);}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function showPipeline(stage) {
  const t=replayTransaction(),n=t?.pipeline.find(n=>n.id===stage);if(!n)return;
  const events=(t.events || t.timeline).filter(e=>e.stage===stage),staff=S.page!=='customer';
  drawer(n.title,badge(n.status,label(n.status))+'<h3 class="section-spacer">Why this stage exists</h3><p>'+esc(n.purpose)+'</p><div class="banner '+(n.status==='unknown'||n.status==='attention'?'amber':'')+'">'+esc(n.summary)+'</div>'+
    metadata([['Transaction',t.id],['Incident',t.incident_id],['Initiated',date(t.initiated_at)],['Source state',label(n.status)]])+
    (events.length?events.map(e=>'<article class="record-details"><strong>'+esc(e.text)+'</strong><p class="field-hint">'+date(e.timestamp)+'</p>'+(staff?recordDetails(e)+citations(e.evidence?[e.evidence.id]:[]):'')+'</article>').join(''):'<div class="banner amber">No source event is available. Absence does not establish failure.</div>')+
    (staff && !S.replay && S.case?button('pipeline-check','Inspect current source','primary','data-stage="'+stage+'"'):''),
    staff?'PAYMENT SOURCE / SAVED EVENTS':'PAYMENT STAGE');
}
function showEvent(id) {
  const e=visibleEvents().find(e=>e.id===id);if(!e)return;
  S.selectedEvent=id;S.selectedPhase=e.phase;renderPage();
  drawer('Event '+e.sequence+' / '+e.title,metadata([['Time',date(e.timestamp)],['Phase',e.phase],['Operation state',e.state],['Record category',e.record_category],['Run',e.run_id],['Incident',e.incident_id]])+
    '<h3>Purpose</h3><p>'+esc(e.purpose)+'</p><h3>What was checked</h3><p>'+esc(e.action)+'</p><h3>Finding</h3><p>'+esc(e.finding)+'</p><h3>What changed</h3><p>'+esc(e.changed)+'</p><h3>Remaining uncertainty</h3><p>'+esc(e.uncertainty)+'</p><h3>Next step</h3><p>'+esc(e.next_step)+'</p><div class="drawer-records">'+citations(e.evidence_ids)+'</div>','OBSERVABLE OPERATION');
}
function modal(title,body,submit,callback,kicker='OPERATOR ACTION') {
  S.dialogSubmit=callback;$('#dialog-title').textContent=tr(title);$('#dialog-body').innerHTML=body;$('#dialog-submit').textContent=tr(submit);$('#dialog-error').textContent='';$('#dialog-kicker').textContent=kicker;
  $('#dialog').showModal();
}
function complaintDialog() {
  if(S.tx.case_id){S.selectedCustomerCase=S.tx.case_id;refresh();$('#content').scrollIntoView({behavior:'smooth'});return;}
  modal('Report an issue',select('issue_type','Issue type',[['PAID_TWICE','Paid Twice'],['STUCK_TRANSFER','Stuck Transfer']],'PAID_TWICE')+
    field('description','What happened?',S.lang==='bn'?'আমার ট্রান্সফারটি যাচাই করুন।':'Please check this transfer. I need the payment records verified.','textarea')+
    '<details class="record-details"><summary>'+esc(tr('Supporting evidence (optional)'))+'</summary>'+
    field('merchant_information','Merchant information (optional)').replace(' required','')+
    field('approximate_time','Approximate time (optional, Bangladesh time)','','datetime-local').replace(' required','')+
    field('supporting_text','Supporting evidence (optional)','','textarea').replace(' required','')+
    '<label class="field"><span>'+esc(tr('Original receipt (optional)'))+'</span><input name="receipt" type="file" accept="image/png,image/jpeg,text/plain"></label>'+
    '<p class="field-hint">For an image, supply its human transcript above. Customer wording is saved separately from confirmed financial records.</p></details>'+
    '<p class="field-hint">Transaction '+esc(S.tx.id)+' · '+money(S.tx.amount_minor)+'. Repeated submissions return this incident’s existing case.</p>','Save complaint',async (f,form)=>{
      const result=await write('/api/transactions/'+S.tx.id+'/complaint',{version:S.tx.version,issue_type:f.get('issue_type'),description:f.get('description'),merchant_information:f.get('merchant_information'),approximate_time:f.get('approximate_time'),supporting_text:f.get('supporting_text')});
      S.selectedCustomerCase=result.case.id;
      const file=$('[name="receipt"]',form).files[0];
      if(file){
        const data=new FormData();data.append('file',file);data.append('transcript',f.get('supporting_text') || f.get('description'));data.append('version',result.case.version);
        await api('/api/cases/'+result.case.id+'/upload',{method:'POST',headers:{'Idempotency-Key':newKey()},body:data});
      }
      await refresh();toast('Complaint saved under one incident.');
    },'CUSTOMER / PAYMENT ISSUE');
}
function uploadDialog() {
  modal('Add evidence',field('evidence_text','Evidence text','','textarea')+
    '<label class="field"><span>'+esc(tr('Receipt or document'))+'</span><input name="receipt" type="file" accept="image/png,image/jpeg,text/plain"></label>'+
    '<p class="field-hint">'+esc(tr('Images require a human transcript in the evidence text above. PNG, JPEG or UTF-8 text; maximum 2 MiB. Uploaded wording remains user-provided evidence.'))+'</p>',
    'Save evidence',async (f,form)=>{
      const file=$('[name="receipt"]',form).files[0],text=f.get('evidence_text');
      if(file){
        const data=new FormData();data.append('file',file);data.append('transcript',text);data.append('version',S.case.version);
        await api('/api/cases/'+S.case.id+'/upload',{method:'POST',headers:{'Idempotency-Key':newKey()},body:data});
      }else await caseWrite('details',{text});
      await refresh();toast('Evidence saved. Analysis and previous approvals now require updated review.');
    },'CUSTOMER EVIDENCE / ORIGINAL PRESERVED');
}
function taskDialog() {
  modal('Request evidence',select('audience','Who should receive the request?',[['customer','Customer'],['merchant','Merchant / partner task'],['internal','Internal team']],'customer')+
    field('question','Specific missing evidence','','textarea')+field('review_hours','Review again in (hours)','4','number'),'Save request',async f=>{
      await caseWrite('task',{audience:f.get('audience'),question:f.get('question'),next_review:new Date(Date.now()+Number(f.get('review_hours'))*3600000).toISOString()});await refresh();toast('Owned evidence request saved.');
    });
}
function handoffDialog() {
  modal('Assign an owned handoff',select('destination','Receiving operator',[['staff_1','Operator 1'],['staff_2','Operator 2']],S.case.owner==='staff_1'?'staff_2':'staff_1')+
    select('team','Operational team',[['Partner Operations','Partner Operations'],['Settlement Operations','Settlement Operations'],['Operations','Operations'],['Merchant Support','Merchant Support']],'Partner Operations')+
    select('priority','Priority',[['HIGH','High'],['NORMAL','Normal'],['LOW','Low']],S.case.priority || 'HIGH')+
    field('reason','Missing evidence / reason',S.run?.recommendation?.reason || '', 'textarea')+
    field('next_action','Next action',S.run?.recommendation?.next_action || 'Obtain the exact partner response and settlement outcome.','textarea'),
    'Request handoff',async f=>{await caseWrite('handoff',Object.fromEntries(f));await refresh();toast('Handoff requested. Current owner retains responsibility until acknowledgement.');});
}
async function download(path,filename) {
  const r=await fetch(path,{headers:{'X-TraceFix-Session':await session()}});
  if(!r.ok)throw Error('Unable to download this authorized record.');
  const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function openRun(id) {
  S.abort?.abort();S.streamId=null;stopReplay();S.replay=false;S.selectedEvent=null;S.selectedPhase=null;
  S.run=await api('/api/investigations/'+id);S.presentationPaused=false;
  const url=new URL(location.href);url.searchParams.set('run',id);url.searchParams.delete('start');url.searchParams.delete('mode');history.replaceState({},'',url);
  renderPage();if(S.run.status==='RUNNING')connectStream(id);
}
async function beginInvestigation(restart=false) {
  stopReplay();S.replay=false;S.selectedEvent=null;S.selectedPhase=null;S.abort?.abort();S.streamId=null;
  const mode=$('#analysis-mode')?.value || params.get('mode') || 'live';
  if(S.page!=='studio'){location.href='/operations/cases/'+S.case.id+'/studio?start=1&mode='+mode;return;}
  const run=await caseWrite('investigations',{mode,restart});
  await refresh(false);await openRun(run.id);toast('Investigation started. Each operation is saved before it appears.');
}
async function connectStream(id) {
  if(S.streamId===id)return;S.streamId=id;S.abort?.abort();const controller=new AbortController();S.abort=controller;
  while(!controller.signal.aborted && S.run?.id===id && S.run.status==='RUNNING') {
    const after=S.run.events?.at(-1)?.sequence || 0;
    try {
      const r=await fetch('/api/investigations/'+id+'/events?after='+after,{headers:{'X-TraceFix-Session':await session(),'Accept':'text/event-stream'},signal:controller.signal});
      if(!r.ok || !r.body)throw Error('Stream unavailable.');
      $('#sync-status').textContent='Authenticated event stream · sequence '+after;
      const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
      for(;;) {
        const {done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});let sep;
        while((sep=buffer.indexOf('\n\n'))>=0) {
          const block=buffer.slice(0,sep);buffer=buffer.slice(sep+2);
          const data=block.split('\n').find(l=>l.startsWith('data: '));if(!data)continue;
          const ev=JSON.parse(data.slice(6));
          if(block.includes('event: investigation')) {
            if(!S.run.events.some(e=>e.sequence===ev.sequence))S.run.events.push(ev);
            S.run.current_phase=ev.phase;S.run.current_finding=ev.finding;
            if(ev.hypotheses)S.run.hypotheses=ev.hypotheses;
            if(!S.replay)renderPage();
          }else if(block.includes('event: complete')){S.run.status=ev.status;await refresh();return;}
        }
      }
      if(S.run?.status==='RUNNING')await refresh();
    } catch(error) {
      if(controller.signal.aborted)return;
      $('#sync-status').textContent='Polling fallback · reconnecting from sequence '+after;
      try{const data=await api('/api/investigations/'+id+'/events?after='+after);for(const e of data.events)if(!S.run.events.some(old=>old.sequence===e.sequence))S.run.events.push(e);S.run.status=data.status;if(data.status!=='RUNNING'){await refresh();return;}renderPage();}catch { /* the next reconnect keeps the cursor */ }
      await delay(2000);
    }
  }
}
function stopReplay() {clearInterval(S.replayTimer);S.replayTimer=null;}
function tickReplay() {
  stopReplay();if(S.replayPaused)return;
  S.replayTimer=setInterval(()=>{
    if(!S.replay || S.replayCursor>=S.run.events.length){S.replayPaused=true;stopReplay();renderPage();return;}
    S.replayCursor++;S.selectedEvent=null;S.selectedPhase=null;renderPage();
  },1000/S.speed);
}
async function advancePayment() {
  S.tx=await write('/api/transactions/'+S.tx.id+'/advance',{version:S.tx.version});await refresh();return S.tx;
}
async function autoPayment() {
  if(S.auto)return;S.auto=true;renderPage();
  try {
    if(S.tx.step===6 && S.tx.can_advance)await advancePayment();
    else while(S.auto && S.tx && S.tx.step<6){await advancePayment();await delay(700);}
  }finally{S.auto=false;renderPage();}
}
async function action(name,el) {
  const id=el.dataset.id;
  switch(name) {
    case 'close-drawer': $('#evidence-drawer').hidden=true;break;
    case 'close-dialog': $('#dialog').close();break;
    case 'preset': S.drafts.amount=el.dataset.amount;renderPage();break;
    case 'select-transfer': S.txId=id;S.selectedCustomerCase=null;await refresh();break;
    case 'select-case': S.selectedCustomerCase=id;await refresh();break;
    case 'advance': await advancePayment();break;
    case 'auto-payment': await autoPayment();break;
    case 'pause-auto': S.auto=false;renderPage();break;
    case 'complaint': complaintDialog();break;
    case 'upload': uploadDialog();break;
    case 'pipeline': showPipeline(el.dataset.stage);break;
    case 'pipeline-check': await caseWrite('pipeline-check',{stage:el.dataset.stage});await refresh();toast('Current source inspected. Payment state is unchanged.');showPipeline(el.dataset.stage);break;
    case 'evidence': await showEvidence(id);break;
    case 'customer-evidence': {
      const e=S.case.evidence_receipts.find(e=>e.id===id);drawer(e.category || 'Customer Evidence','<blockquote>'+esc(e.text)+'</blockquote><p class="field-hint">'+date(e.at)+' · User-provided assertion.</p>'+button('original','Download original','secondary','data-id="'+id+'"')+(e.mime?.startsWith('image/')?'<div id="original-preview"></div>':''),'YOUR SAVED EVIDENCE');if(e.mime?.startsWith('image/'))await previewOriginal(id);break;
    }
    case 'original': {
      const mime=S.case.evidence?.find(e=>e.id===id)?.blob?.mime || S.case.evidence_receipts?.find(e=>e.id===id)?.mime;
      await download('/api/evidence/'+id+'/file',id+'.'+(mime==='image/png'?'png':mime==='image/jpeg'?'jpg':'txt'));break;
    }
    case 'event': showEvent(id);break;
    case 'phase': {
      S.selectedPhase=el.dataset.phase;S.selectedEvent=null;
      const e=visibleEvents().findLast(e=>e.phase===S.selectedPhase);
      if(e)showEvent(e.id);
      else {renderPage();const p=PHASES.find(p=>p[0]===S.selectedPhase);drawer(p[1],'<h3>Purpose</h3><p>'+esc(p[2])+'</p><div class="banner">This phase has no recorded operation at the current playback step. No finding has been established.</div>','INVESTIGATION PHASE');}
      break;
    }
    case 'case-tab': S.tab=el.dataset.tab;renderPage();break;
    case 'analyze': await beginInvestigation(S.page==='studio');break;
    case 'zoom-in': S.zoom=Math.min(2.5,S.zoom+.2);renderPage();break;
    case 'zoom-out': S.zoom=Math.max(.5,S.zoom-.2);renderPage();break;
    case 'fit': S.zoom=1;S.panX=0;S.panY=0;renderPage();break;
    case 'expand': S.expanded=!S.expanded;renderPage();break;
    case 'pause-view': S.presentationPaused=!S.presentationPaused;S.presentationCursor=S.run.events.length;renderPage();break;
    case 'replay': S.replay=true;S.replayCursor=0;S.replayPaused=false;S.selectedEvent=null;S.selectedPhase=null;$('#evidence-drawer').hidden=true;renderPage();tickReplay();break;
    case 'replay-toggle': S.replayPaused=!S.replayPaused;renderPage();tickReplay();break;
    case 'replay-start': S.replayCursor=0;S.selectedEvent=null;S.selectedPhase=null;renderPage();tickReplay();break;
    case 'replay-exit': stopReplay();S.replay=false;S.selectedEvent=null;S.selectedPhase=null;renderPage();break;
    case 'task': taskDialog();break;
    case 'handoff': handoffDialog();break;
    case 'acknowledge': await caseWrite('acknowledge',{});await refresh();toast('Handoff accepted. Receiving operator now owns follow-up.');break;
    case 'schedule': modal('Schedule next review',field('hours','Review again in (hours)','4','number'),'Save review',async f=>{await caseWrite('review',{next_review:new Date(Date.now()+Number(f.get('hours'))*3600000).toISOString()});await refresh();});break;
    case 'reply-task': modal('Reply to request',field('reply','Evidence / response','','textarea'),'Send',async f=>{await caseWrite('messages',{text:f.get('reply'),task_id:id});await refresh();});break;
    case 'resolve-task': modal('Review an evidence response',select('evidence_id','Cited evidence',S.case.evidence.map(e=>[e.id,short(e.id)+' · '+evidenceText(e).slice(0,60)]),S.case.tasks.find(t=>t.id===id).response_evidence_id)+field('reason','How does this evidence address the request?','','textarea'),'Resolve request',async f=>{await caseWrite('resolve-task',{task_id:id,evidence_id:f.get('evidence_id'),reason:f.get('reason')});await refresh();toast('Request reviewed with a saved citation.');});break;
    case 'staff-evidence': modal('Add operator evidence',select('kind','Evidence type',[['staff_supplied','Operator note'],['merchant_supplied','Merchant statement'],['repayment_request','Repayment request']],'staff_supplied')+field('text','Evidence text','','textarea')+'<p class="field-hint">Supplied notes and statements cannot establish a financial posting. Only scoped source records grant authority.</p>','Save evidence',async f=>{await caseWrite('evidence',Object.fromEntries(f));await refresh();toast('Evidence saved. Analysis needs updated review.');});break;
    case 'correct-evidence': {
      const e=S.case.evidence.find(e=>e.id===id);
      modal('Correct a supplied transcript',field('text','Corrected text',evidenceText(e),'textarea')+field('reason','Reason for correction','','textarea'),'Save revision',async f=>{await caseWrite('correct',{evidence_id:id,...Object.fromEntries(f)});await refresh();await showEvidence(id);});break;
    }
    case 'approve': modal('Approve the cited sandbox repair','<div class="banner">Action: '+esc(label(S.run.eligibility.action))+' · '+money(S.run.eligibility.amount_minor)+'. The backend will check current evidence and permission again before execution.</div>'+field('note','Why does this evidence authorize the action?','','textarea')+citations(S.run.recommendation.evidence_ids),'Save approval',async f=>{await caseWrite('approvals',{run_id:S.run.id,recommendation_id:S.run.recommendation.id,note:f.get('note')});await refresh();toast('Approval saved. Execute Sandbox Repair is now a separate available action.');});break;
    case 'execute': {
      const a=S.run.approvals.findLast(a=>a.run_id===S.run.id&&a.status==='APPROVED');
      if(!a)throw Error('A current recorded approval is required.');
      await caseWrite('repairs/execute',{approval_id:a.id});await refresh();toast('Balanced sandbox correction verified. Transaction and case resolved.');break;
    }
    case 'reject': caseDecision('REJECT_REPAIR','Reject the proposed repair');break;
    case 'no-repair': caseDecision('RESOLVED_NO_REPAIR','Record a verified no-repair outcome');break;
    case 'report-md': case 'report-json': {
      const format=name==='report-md'?'md':'json';await download('/api/cases/'+S.case.id+'/report?format='+format,S.case.reference+'.'+format);toast('Saved audit report downloaded.');break;
    }
    case 'reset': modal('Reset this isolated scenario','<div class="banner">Start a fresh transaction and incident with the same synthetic fixture. This case, its saved runs, corrections and unrelated cases remain in history.</div>','Create fresh scenario',async ()=>{
      const t=await write('/api/demo/scenarios/'+S.tx.id+'/reset',{});toast('Fresh isolated scenario created.');
      $('#dialog').close();drawer('Fresh scenario ready','<p class="mono">'+esc(t.id)+'</p><p>Its previous case history remains intact.</p><a class="button primary" href="/customer?transaction='+t.id+'">Open new customer transfer ↗</a>');
    });break;
  }
}
function caseDecision(decision,title) {
  modal(title,field('note','Verified customer update','','textarea')+citations(S.run.recommendation.evidence_ids),'Record decision',async f=>{await caseWrite('operator-outcome',{run_id:S.run.id,decision,note:f.get('note')});await refresh();toast('Cited operator decision saved.');});
}
document.addEventListener('click',async ev=>{
  const el=ev.target.closest('[data-action]');if(!el||el.disabled)return;
  if(S.suppressGraphClick>Date.now()&&el.closest('#agent-graph'))return;
  const safe=['close-drawer','close-dialog','pause-auto','phase','event','evidence','pipeline','case-tab','zoom-in','zoom-out','fit','expand','replay-toggle','replay-exit','replay-start'];
  if(S.busy&&!safe.includes(el.dataset.action))return;
  const isBusy=!safe.includes(el.dataset.action);if(isBusy){S.busy=true;el.disabled=true;}
  try{await action(el.dataset.action,el);}catch(error){toast(error.message,true);if(error.status===409)await refresh().catch(()=>{});}finally{if(isBusy){S.busy=false;renderPage();if(el.isConnected)el.disabled=false;}}
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape')$('#evidence-drawer').hidden=true;
  const el=ev.target.closest('svg [data-action]');
  if(el&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
document.addEventListener('input',ev=>{
  const name=ev.target.name;if(!name)return;
  if(name==='search'){S.search=ev.target.value;$('#queue-rows').innerHTML=queueRows();return;}
  if(ev.target.closest('#content'))S.drafts[name]=ev.target.value;
});
document.addEventListener('change',async ev=>{
  const el=ev.target;
  try {
    if(el.id==='language'){S.lang=el.value;localStorage.setItem('tf.language',S.lang);updateShell();renderPage();}
    else if(el.id==='identity'){S.role=el.value;localStorage.setItem('tf.operator',S.role);S.abort?.abort();S.streamId=null;await session();updateShell();await refresh();if(S.run?.status==='RUNNING')connectStream(S.run.id);}
    else if(el.name==='filter'){S.filter=el.value;$('#queue-rows').innerHTML=queueRows();}
    else if(el.name==='run-history'&&el.value)await openRun(el.value);
    else if(el.id==='analysis-mode')S.analysisMode=el.value;
    else if(el.name==='follow'){S.follow=el.checked;applyGraphTransform();}
    else if(el.name==='replay-speed'){S.speed=Number(el.value);tickReplay();}
  }catch(error){toast(error.message,true);}
});
document.addEventListener('submit',async ev=>{
  ev.preventDefault();const form=ev.target;if(S.busy)return;
  if(form.id!=='dialog-form'&&!form.dataset.form)return;
  S.busy=true;const submit=$('[type="submit"]',form);if(submit)submit.disabled=true;
  try {
    const f=new FormData(form);
    if(form.id==='dialog-form'){await S.dialogSubmit(f,form);$('#dialog').close();}
    else if(form.dataset.form==='transfer'){
      const amount=Math.round(Number(f.get('amount'))*100);if(!Number.isSafeInteger(amount)||amount<1)throw Error('Enter a valid amount in BDT.');
      const t=await write('/api/transactions',{amount_minor:amount,customer_name:f.get('customer_name'),scenario:f.get('scenario')});
      S.txId=t.id;S.selectedCustomerCase=null;await refresh();toast('Transfer saved.');
    } else if(form.dataset.form==='message') {
      await caseWrite('messages',{text:f.get('message')});S.drafts.message='';await refresh();toast('Message saved.');
    }
  }catch(error){
    if(form.id==='dialog-form')$('#dialog-error').textContent=error.message;else toast(error.message,true);
    if(error.status===409)await refresh().catch(()=>{});
  }finally{S.busy=false;renderPage();if(submit?.isConnected)submit.disabled=false;}
});
$('#refresh-page').addEventListener('click',async()=>{try{await refresh();toast('Saved records refreshed.');}catch(e){toast(e.message,true);}});
window.addEventListener('pagehide',()=>{S.abort?.abort();clearInterval(S.pollTimer);stopReplay();S.auto=false;});
async function init() {
  updateShell();await session();await refresh();
  if(S.page==='studio'){
    if(params.get('mode'))$('#analysis-mode').value=params.get('mode');
    if(params.get('start')==='1')await beginInvestigation(false);
    else {
      const id=params.get('run') || S.case.current_run_id || S.runs[0]?.id;
      if(id)await openRun(id);
    }
  }
  S.pollTimer=setInterval(async()=>{
    if(S.busy||S.auto||$('#dialog').open||S.replay||document.hidden)return;
    try{await refresh();if(S.run?.status==='RUNNING'&&S.streamId!==S.run.id)connectStream(S.run.id);}catch(e){$('#sync-status').textContent='Connection interrupted · Refresh to retry';}
  },S.page==='studio'?3000:10000);
}
init().catch(error=>{toast(error.message,true);$('#content').innerHTML=empty('Workspace unavailable',error.message)+button('retry-init','Reload workspace','primary');$('[data-action="retry-init"]')?.addEventListener('click',()=>location.reload());});
