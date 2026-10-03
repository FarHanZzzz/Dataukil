/* QR-only image-coordinate reader and saved field-review drafts. No OCR claims. */
"use strict";
window.QRReceipt=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const records=new Map(),states=new Map();
  let animation=null,focusReturn=null;
  const label=key=>key.startsWith('line_items.')?`Item ${Number(key.split('.')[1])+1}`:key.replaceAll('_',' ');
  function keyFor(c){return `${c.id}:${c.evidence_version}:${c.qr_pipeline?.receipt_scan?.scan_id||'original'}`;}
  function draft(c){
    const key=keyFor(c),scan=c.qr_pipeline?.receipt_scan;
    let stored;try{stored=JSON.parse(sessionStorage.getItem('qr.review.'+key));}catch{}
    if(stored)return stored;
    const review=c.qr_pipeline?.receipt_review;
    const valid=review?.scan_id===scan?.scan_id && review?.evidence_version===c.evidence_version;
    const mapping={},missing=[];
    for(const field of scan?.field_associations||[]){
      if(field.field==='barcode')continue;
      mapping[field.field]=valid?(review.field_regions[field.field]||[]):field.region_ids;
      if(valid?review.missing_fields.includes(field.field):!field.region_ids.length||field.displayed_value==null)missing.push(field.field);
    }
    return {field_regions:mapping,missing_fields:missing,ack:!!valid,reason:valid?review.reason:'Reviewed the original, detected regions and preserved transcript; missing fields explicitly acknowledged.'};
  }
  function canVerify(c){const d=draft(c);return d.ack&&!!d.reason.trim();}
  function updateVerify(c){const button=document.querySelector('[data-check=marketplace]');if(button&&button.dataset.receiptOwner==='true'&&!button.hasAttribute('data-busy'))button.disabled=!canVerify(c);}
  function save(c,value){sessionStorage.setItem('qr.review.'+keyFor(c),JSON.stringify(value));updateVerify(c);}
  function viewData(record,state){
    const scan=record.scan;
    const derived=scan?.manifest_version===2;
    const processed=state.view!=='original' && derived;
    return {src:processed?`data:image/png;base64,${scan.clean_preview_base64}`:state.view==='annotated'&&scan?`data:image/png;base64,${scan.preview_base64}`:record.src,
      overlay:processed&&state.view==='annotated',width:scan?.image_width||900,height:scan?.image_height||1500};
  }
  function reader(record){
    records.set(record.key,record);
    const state=states.get(record.key)||{view:record.scan?'annotated':'original',zoom:1,selected:[]};states.set(record.key,state);
    const data=viewData(record,state),scan=record.scan;
    return `<div class="qr-reader" data-reader-key="${esc(record.key)}"><div class="qr-reader-toolbar"><div class="qr-reader-tabs" role="group" aria-label="Receipt view">${['original','processed','annotated'].map(view=>`<button type="button" class="button quiet small" data-receipt-view="${view}" aria-pressed="${state.view===view}" ${view!=='original'&&!scan||view==='processed'&&scan?.manifest_version!==2?'disabled':''}>${view[0].toUpperCase()+view.slice(1)}</button>`).join('')}</div><div class="qr-reader-tools" role="group" aria-label="Receipt zoom"><button type="button" class="button quiet small" data-receipt-zoom="out" aria-label="Zoom receipt out">−</button><button type="button" class="button quiet small" data-receipt-zoom="in" aria-label="Zoom receipt in">+</button><button type="button" class="button quiet small" data-receipt-zoom="fit">Fit</button><button type="button" class="button secondary small" data-receipt-enlarge>View larger</button></div></div><div class="qr-reader-scroll" tabindex="0" aria-label="Receipt image; use zoom controls to read details" data-scroll="receipt"><div class="qr-paper-canvas" style="width:${state.zoom*100}%"><img src="${data.src}" alt="${state.view==='original'?'Immutable original receipt':'Processed receipt; visual regions are advisory'}">${scan?.manifest_version===2?`<svg class="qr-region-overlay" viewBox="0 0 ${data.width} ${data.height}" aria-hidden="true" ${data.overlay?'':'hidden'}>${scan.regions.map((region,i)=>`<g data-region="${esc(region.id)}"><rect x="${region.bbox[0]}" y="${region.bbox[1]}" width="${region.bbox[2]}" height="${region.bbox[3]}"/><text x="${region.bbox[0]}" y="${Math.max(14,region.bbox[1]-3)}">${i+1}</text></g>`).join('')}</svg>`:''}<span class="qr-scan-beam" hidden aria-hidden="true"></span></div></div><div class="qr-reader-downloads"><button type="button" class="button quiet small" data-receipt-download="original">Download original</button>${scan?'<button type="button" class="button quiet small" data-receipt-download="annotated">Download annotated preview</button>':''}</div></div>`;
  }
  function render(c,receipt,readOnly=false){
    const scan=c.qr_pipeline?.receipt_scan;
    if(!receipt)return '<section id="qr-evidence" class="qr-evidence-section"><h3>Receipt evidence</h3><p>Request the customer’s original receipt image before scanning.</p></section>';
    const key=keyFor(c),record={key,src:`data:${receipt.blob.mime};base64,${receipt.blob.base64}`,scan,c,receipt};
    const d=draft(c);
    const fresh=scan?.manifest_version===2&&scan.evidence_version===c.evidence_version;
    const fields=fresh?`<div class="qr-fields qr-field-review" data-review-key="${esc(key)}"><div class="qr-review-heading"><span class="eyebrow">REVIEW THE PRINTED FIELDS</span><h4>Check what the receipt says</h4><p>Values come from the preserved transcript. The boxes identify visual regions.</p></div>${scan.field_associations.filter(f=>f.field!=='barcode').map(field=>{
      const regions=d.field_regions[field.field]||[],missing=d.missing_fields.includes(field.field);
      return `<article class="qr-review-field ${missing?'review':''}" data-review-field="${esc(field.field)}"><button type="button" class="qr-field-highlight" data-receipt-field="${esc(field.field)}" data-receipt-key="${esc(key)}"><span>${esc(label(field.field))}</span><strong>${esc(field.displayed_value??'Transcript value missing')}</strong><small>${missing?'Not printed / cannot locate · acknowledged on review':'Preserved transcript · compare against original'}</small></button><details><summary>Region on receipt · ${missing?'missing':regions.length+' detected'}</summary><label class="field"><span>Map ${esc(label(field.field))} (select one or more)</span><select id="receipt-map-${esc(field.field.replaceAll('.','-'))}" data-receipt-map="${esc(field.field)}" multiple size="3" ${readOnly?'disabled':''}><option value="" ${missing?'selected':''}>Not printed / cannot locate</option>${scan.regions.map((r,i)=>`<option value="${esc(r.id)}" ${!missing&&regions.includes(r.id)?'selected':''}>${i+1} · ${esc(label(r.field))}</option>`).join('')}</select></label></details></article>`;
    }).join('')}<label class="qr-review-ack"><input type="checkbox" id="receipt-review-ack" ${d.ack?'checked':''} ${readOnly?'disabled':''}>I reviewed the highlighted fields and acknowledged missing information.</label><label class="field"><span>Review note</span><textarea id="receipt-review-reason" maxlength="1000" rows="3" ${readOnly?'readonly':''}>${esc(d.reason)}</textarea></label></div>`:'';
    return `<section id="qr-evidence" class="qr-evidence-section" data-task-key="${esc(key)}"><div class="section-heading"><div><span class="eyebrow">CUSTOMER SUPPLIED · UNVERIFIED</span><h3>Read the receipt, then investigate</h3></div><span>Original preserved</span></div><div class="qr-evidence-layout">${reader(record)}${fields}</div><p class="qr-scan-announcement" role="status" aria-live="polite">${fresh?'Visual scan complete — review the highlighted fields.':'Ready to scan the original receipt.'}</p>${fresh?'<div class="qr-scan-controls"><button type="button" class="button secondary small" data-receipt-replay>Replay scan</button><button type="button" class="button secondary small" data-receipt-skip hidden>Skip animation</button></div>':''}<details class="qr-receipt-metadata"><summary>Original hash and processing provenance</summary><dl class="qr-metadata"><dt>SHA-256</dt><dd>${esc(receipt.original_hash)}</dd><dt>Source artifact</dt><dd>${esc(receipt.id)}</dd>${scan?`<dt>Visual engine</dt><dd>OpenCV ${esc(scan.engine.version)} · manifest v${scan.manifest_version||1}</dd><dt>Coordinates</dt><dd>${scan.image_width} × ${scan.image_height} · ${scan.manifest_version===2?'preview pixels':'legacy scan'}</dd><dt>Processing</dt><dd>${esc(scan.processing.join(' → '))}</dd><dt>Saved at</dt><dd>${esc(scan.at)}</dd>`:''}</dl>${scan?`<ul>${scan.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}</details><details><summary>Accessible receipt transcript</summary><p class="qr-transcript">${esc(receipt.revisions.at(-1).text)}</p><button type="button" class="button secondary small" data-receipt-correct ${readOnly?'disabled':''}>Correct transcript</button></details></section>`;
  }
  function refreshReader(el){
    const record=records.get(el.dataset.readerKey),state=states.get(el.dataset.readerKey);if(!record||!state)return;
    const data=viewData(record,state);el.querySelector('img').src=data.src;el.querySelector('img').alt=state.view==='original'?'Immutable original receipt':'Processed receipt; visual regions are advisory';el.querySelector('.qr-paper-canvas').style.width=state.zoom*100+'%';
    const overlay=el.querySelector('.qr-region-overlay');if(overlay)overlay.toggleAttribute('hidden',!data.overlay);
    el.querySelectorAll('[data-receipt-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.receiptView===state.view));
    el.querySelectorAll('[data-region]').forEach(g=>g.classList.toggle('selected',state.selected.includes(g.dataset.region)));
  }
  function mount(root){root.querySelectorAll('.qr-reader').forEach(refreshReader);}
  function reviewPayload(c){
    const d=draft(c),scan=c.qr_pipeline.receipt_scan;
    if(!d.ack)throw Error('Review the highlighted receipt fields and acknowledge missing information first.');
    if(!d.reason.trim())throw Error('Add a short review note.');
    return {action:'review_receipt',scan_id:scan.scan_id,field_regions:d.field_regions,
      reviewed_fields:scan.field_associations.filter(f=>f.field!=='barcode').map(f=>f.field),missing_fields:d.missing_fields,reason:d.reason};
  }
  function enlarge(record){
    let dialog=document.getElementById('receipt-reader-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='receipt-reader-dialog';dialog.setAttribute('aria-labelledby','receipt-reader-title');dialog.className='qr-reader-dialog';document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.innerHTML='';focusReturn?.focus({preventScroll:true});});}
    focusReturn=document.activeElement;
    const enlarged={...record,key:record.key+':enlarged'};states.set(enlarged.key,{...states.get(record.key),selected:[...(states.get(record.key)?.selected||[])]});
    dialog.innerHTML=`<header><div><span class="eyebrow">RECEIPT EVIDENCE</span><h2 id="receipt-reader-title">Read every detail</h2></div><button type="button" class="button secondary" data-receipt-close>Close</button></header>${reader(enlarged)}`;
    dialog.showModal();mount(dialog);
  }
  function customer(receipt,key){if(!receipt)return;enlarge({key:'customer:'+key,src:`data:${receipt.mime};base64,${receipt.base64}`,scan:null});}
  function cancel(){if(animation){animation.skip=true;animation=null;}}
  async function animate(c){
    const key=keyFor(c),record=records.get(key),scan=record?.scan;
    if(!scan||scan.manifest_version!==2)return;
    cancel();const token={key,skip:false};animation=token;
    const el=[...document.querySelectorAll('#desk .qr-reader')].find(e=>e.dataset.readerKey===key);if(!el)return;
    const state=states.get(key);state.view='annotated';refreshReader(el);
    const groups=[...el.querySelectorAll('[data-region]')],beam=el.querySelector('.qr-scan-beam'),section=el.closest('#qr-evidence'),live=section.querySelector('.qr-scan-announcement');
    const skip=section.querySelector('[data-receipt-skip]'),replay=section.querySelector('[data-receipt-replay]');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){live.textContent='Visual scan complete — review the highlighted fields.';animation=null;return;}
    if(skip)skip.hidden=false;if(replay)replay.disabled=true;beam.hidden=false;groups.forEach(g=>g.style.visibility='hidden');
    const started=performance.now();let announced=-1;
    await new Promise(resolve=>{
      function frame(time){
        if(token.skip||animation!==token||!el.isConnected){resolve();return;}
        const progress=Math.min(1,(time-started)/6000),y=progress*scan.image_height;
        beam.style.top=progress*100+'%';
        groups.forEach((g,i)=>{const visible=scan.regions[i].bbox[1]<=y;g.style.visibility=visible?'visible':'hidden';if(visible&&i>announced){announced=i;live.textContent='Scanning '+label(scan.regions[i].field);}});
        const current=scan.regions[announced];section.querySelectorAll('[data-review-field]').forEach(row=>row.classList.toggle('current',row.dataset.reviewField===current?.field));
        const scroll=el.querySelector('.qr-reader-scroll');scroll.scrollTop=Math.max(0,progress*el.querySelector('.qr-paper-canvas').offsetHeight-scroll.clientHeight*.55);
        if(progress<1)requestAnimationFrame(frame);else resolve();
      }requestAnimationFrame(frame);
    });
    beam.hidden=true;groups.forEach(g=>g.style.visibility='');if(skip)skip.hidden=true;if(replay)replay.disabled=false;
    live.textContent='Visual scan complete — review the highlighted fields.';section.querySelectorAll('.current').forEach(row=>row.classList.remove('current'));
    if(animation===token)animation=null;
  }
  document.addEventListener('change',event=>{
    const panel=event.target.closest('[data-review-key]');if(!panel)return;
    const record=records.get(panel.dataset.reviewKey);if(!record)return;
    const d=draft(record.c),key=event.target.dataset.receiptMap;
    if(key){
      const selected=[...event.target.selectedOptions].map(o=>o.value),missing=selected.includes('')||!selected.length;
      d.field_regions[key]=missing?[]:selected;d.missing_fields=d.missing_fields.filter(k=>k!==key);if(missing)d.missing_fields.push(key);
      event.target.querySelectorAll('option').forEach(o=>o.selected=missing?o.value==='':selected.includes(o.value));
      const row=event.target.closest('.qr-review-field');row.classList.toggle('review',missing);
      row.querySelector('.qr-field-highlight small').textContent=missing?'Not printed / cannot locate · acknowledged on review':'Preserved transcript · compare against original';
      row.querySelector('summary').textContent='Region on receipt · '+(missing?'missing':selected.length+' detected');
      d.ack=false;panel.querySelector('#receipt-review-ack').checked=false;
      const state=states.get(record.key);state.selected=d.field_regions[key];document.querySelectorAll('.qr-reader').forEach(refreshReader);
    }
    if(event.target.id==='receipt-review-ack')d.ack=event.target.checked;
    if(event.target.id==='receipt-review-reason')d.reason=event.target.value;
    save(record.c,d);
  });
  document.addEventListener('input',event=>{if(event.target.id==='receipt-review-reason'){const panel=event.target.closest('[data-review-key]'),record=records.get(panel?.dataset.reviewKey);if(record){const d=draft(record.c);d.reason=event.target.value;save(record.c,d);}}});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const el=button.closest('.qr-reader'),record=records.get(el?.dataset.readerKey),state=states.get(el?.dataset.readerKey);
    if(button.hasAttribute('data-receipt-close')){document.getElementById('receipt-reader-dialog').close();return;}
    if(button.hasAttribute('data-receipt-skip')){if(animation)animation.skip=true;return;}
    if(button.hasAttribute('data-receipt-replay')){const c=records.get(button.closest('#qr-evidence').querySelector('.qr-reader').dataset.readerKey)?.c;if(c)animate(c);return;}
    if(button.dataset.receiptField){const r=records.get(button.dataset.receiptKey);if(r){const s=states.get(r.key);s.view='annotated';s.selected=draft(r.c).field_regions[button.dataset.receiptField]||[];document.querySelectorAll('.qr-reader').forEach(refreshReader);
      const el=[...document.querySelectorAll('.qr-reader')].find(e=>e.dataset.readerKey===r.key),region=r.scan.regions.find(region=>s.selected.includes(region.id));
      if(el&&region)el.querySelector('.qr-reader-scroll').scrollTop=Math.max(0,region.bbox[1]/r.scan.image_height*el.querySelector('.qr-paper-canvas').offsetHeight-80);}return;}
    if(!record||!state)return;
    if(button.dataset.receiptView){state.view=button.dataset.receiptView;refreshReader(el);}
    if(button.dataset.receiptZoom){state.zoom=button.dataset.receiptZoom==='fit'?1:Math.max(.5,Math.min(3,state.zoom+(button.dataset.receiptZoom==='in'?.25:-.25)));refreshReader(el);}
    if(button.hasAttribute('data-receipt-enlarge'))enlarge(record);
    if(button.dataset.receiptDownload){const derived=button.dataset.receiptDownload==='annotated';const src=derived?`data:image/png;base64,${record.scan.preview_base64}`:record.src;const link=document.createElement('a');link.href=src;link.download=`${record.receipt?.id||'receipt'}-${derived?'annotated-preview':'original'}.${src.startsWith('data:image/jpeg')?'jpg':'png'}`;link.click();}
  });
  document.addEventListener('keydown',event=>{const dialog=document.getElementById('receipt-reader-dialog');if(!dialog?.open||event.target.matches('input,textarea,select'))return;const el=dialog.querySelector('.qr-reader'),state=states.get(el?.dataset.readerKey);if(!state)return;if(['+','=','-','0'].includes(event.key)){event.preventDefault();state.zoom=event.key==='0'?1:Math.max(.5,Math.min(3,state.zoom+(event.key==='-'?-.25:.25)));refreshReader(el);}});
  return {render,mount,reviewPayload,animate,cancel,customer,canVerify,currentAnimationKey:()=>animation?.key};
})();
