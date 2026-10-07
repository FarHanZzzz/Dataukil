/* QR topology and append-only event reducer. Independent of the Add money graph. */
"use strict";
window.QRGraph = (() => {
  const groups = [
    ["Evidence", [["receipt_received", "Receipt received"], ["receipt_scan", "Receipt scan"], ["annotated_fields", "Annotated fields"]]],
    ["DataDNA", [["policy_gate", "Purpose & access"], ["field_release", "Minimum field release"], ["privacy_audit", "Access decision log"]]],
    ["Marketplace", [["purchase_lookup", "Purchase lookup"], ["order_match", "Order match"], ["amount_match", "Amount & item match"]]],
    ["Payments", [["qr_lookup", "QR transaction"], ["bank_debit", "Bank debit"], ["cash_claim", "Cash receipt claim"]]],
    ["Decision", [["legitimate", "Legitimate"], ["rejected", "Rejected"], ["uncertain", "Uncertain"]]],
    ["Resolution", [["refund_eligibility", "Refund eligibility"], ["refund_request", "Refund request"], ["refund_posted", "Refund posted"], ["customer_notification", "Customer notified"], ["human_handoff", "Human handoff"]]],
  ];
  const links = [["receipt_received","receipt_scan"],["receipt_scan","annotated_fields"],["annotated_fields","policy_gate"],
    ["policy_gate","field_release"],["field_release","privacy_audit"],["privacy_audit","purchase_lookup"],
    ["purchase_lookup","order_match"],["order_match","amount_match"],["amount_match","qr_lookup"],
    ["qr_lookup","bank_debit"],["bank_debit","cash_claim"],["cash_claim","legitimate"],["cash_claim","rejected"],["cash_claim","uncertain"],
    ["legitimate","refund_eligibility"],["refund_eligibility","refund_request"],["refund_request","refund_posted"],
    ["refund_posted","customer_notification"],["rejected","customer_notification"],["uncertain","human_handoff"]];
  const labels = {unknown:"Not checked",active:"In progress",completed:"Completed",uncertain:"Needs review",rejected:"Conflict found",handoff:"Human review"};
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const explanations = {
    receipt_received:'The uploaded original is preserved with a hash. Customer evidence is a claim to review, not independent payment proof.',
    receipt_scan:'The local OpenCV processor locates visual regions. Printed values come from the preserved transcript; this step does not authenticate the receipt.',
    annotated_fields:'The operator maps and acknowledges every required field, including missing information. Changed evidence invalidates pending conclusions.',
    policy_gate:'Before a source read, DataDNA checks the actor, linked case, purpose, approved synthetic basis and destination. A denied request cannot retrieve source data.',
    field_release:'Only the approved structured field projection reaches the case investigator. Identity details and unrestricted receipt content remain at their source.',
    privacy_audit:'The saved trace records who requested which field names, why, under which policy and with what decision. Production still needs privacy, security and lifecycle assurance.',
    purchase_lookup:'Retrieve only the saved Marketplace order for this purchase. No external database call or production pilot is performed.',
    order_match:'Match the merchant, purchase reference and receipt timestamp to the independent saved order.',
    amount_match:'Match itemization, currency, subtotal, tax and invoice total. Financial amounts use integer poisha.',
    qr_lookup:'Use the exact linked QR reference. A failed customer screen alone cannot prove the payment failed.',
    bank_debit:'Corroborate the posted QR amount with the exact synthetic bank debit reference; missing confirmation stays uncertain.',
    cash_claim:'Corroborate cash received and its cash reference against the source record, independently of the customer receipt.',
    legitimate:'A duplicate is supported only when verified QR plus confirmed cash exceeds the invoice and the excess fits within the QR debit.',
    rejected:'Record the specific source conflict or absence of overpayment. A valid split payment can have a legitimate receipt and no refundable duplication.',
    uncertain:'Missing or unavailable evidence pauses automation. The investigator retains ownership and asks for the missing proof.',
    refund_eligibility:'The proposal cites the current evidence and data policy versions. The operator explicitly approves the exact eligible excess.',
    refund_request:'Approval creates a synthetic request. It does not establish that funds were returned.',
    refund_posted:'Only a separate saved simulated completion establishes this outcome; this hackathon does not move real funds.',
    customer_notification:'Share the explanation and outcome for this case, without internal catalogs, raw investigation metadata or other customers’ records.',
    human_handoff:'Save the receiving queue, missing proof and next review. Ownership changes only after the receiving investigator accepts.',
  };
  function reduce(events, count=events.length) {
    const nodes=Object.fromEntries(groups.flatMap(([,items])=>items.map(([id])=>[id,{state:"unknown",events:[]}])));
    let current=null;
    for(const event of events.slice(0,count)) {
      if(!nodes[event.node]) continue;
      nodes[event.node].state=event.state;nodes[event.node].events.push(event);current=event.node;
    }
    return {nodes,current,count};
  }
  function render(events, options={}) {
    const count=options.count ?? events.length, width=groups.length*238+10;
    const model=reduce(events,count);const pos={};
    groups.forEach(([,items],column)=>items.forEach(([id],row)=>pos[id]=[column*238+24, row*100+72]));
    const current=options.active || model.current;
    const edges=links.map(([from,to],i)=>{
      const a=pos[from],b=pos[to]; const vertical=a[0]===b[0];
      const start=vertical?[a[0]+95,a[1]+72]:[a[0]+190,a[1]+36];
      const end=vertical?[b[0]+95,b[1]]:[b[0],b[1]+36];
      const path=vertical?`M${start} L${end}`:`M${start} C${start[0]+24},${start[1]} ${end[0]-24},${end[1]} ${end}`;
      const dest=model.nodes[to];const active=to===current && (options.active || dest.state!=="unknown");
      const state=active?'active':dest.state;
      return `<path class="qr-edge ${state}" d="${path}" marker-end="url(#qr-arrow-${state==='unknown'?'unknown':'active'})" data-from="${from}" data-to="${to}"/>`;
    }).join('');
    const frames=groups.map(([name,items],col)=>`<g class="qr-group"><rect x="${col*238+10}" y="20" width="218" height="${items.length*100+68}" rx="16"/><text x="${col*238+24}" y="48">${name.toUpperCase()}</text></g>`).join('');
    const nodes=groups.flatMap(([,items])=>items.map(([id,title])=>{
      const saved=model.nodes[id];const state=options.active===id?'active':saved.state;const [x,y]=pos[id];
      return `<g class="qr-node ${state} ${options.selected===id?'selected':''}" transform="translate(${x},${y})" tabindex="0" role="button" data-qr-node="${id}" aria-label="${escape(title)}: ${labels[state]}"><rect width="190" height="72" rx="10"/><text class="qr-node-icon" x="12" y="27">${state==='completed'?'✓':state==='uncertain'?'!':state==='rejected'?'×':state==='handoff'?'↗':state==='active'?'●':'○'}</text><text class="qr-node-title" x="32" y="27">${title}</text><text class="qr-node-status" x="12" y="51">${labels[state]}</text></g>`;
    })).join('');
    const detail=model.nodes[options.selected]?.events.at(-1);
    const privacy=detail?.data_dna;
    const inspector=options.selected?`<strong>${escape(groups.flatMap(([,items])=>items).find(([id])=>id===options.selected)?.[1])}</strong><p>${escape(explanations[options.selected]||'')}</p>${detail?`<p class="qr-inspector-result">${escape(detail.detail||'Saved '+detail.kind.replaceAll('_',' ').toLowerCase())}</p><small>Event ${detail.sequence} · ${escape(detail.actor)} · Evidence v${detail.evidence_version}</small>${privacy?`<dl class="qr-dna-meta"><dt>Policy decision</dt><dd>${escape(privacy.decision)} · ${escape(privacy.policy_version)}</dd><dt>Source → recipient</dt><dd>${escape(privacy.source)} → ${escape(privacy.recipient)}</dd><dt>Fields permitted for release</dt><dd>${escape(privacy.released_fields.join(', ')||'None')}</dd><dt>Withheld field names</dt><dd>${escape(privacy.withheld_fields.join(', ')||'None')}</dd></dl>`:''}<div class="qr-citations">${(detail.evidence_ids||[]).map(id=>`<button class="button quiet small" data-evidence="${escape(id)}">View evidence ${escape(id.slice(-6))}</button>`).join('')}</div>`:'<small>No saved event for this step yet.</small>'}`:'Select any node to see its purpose, saved result and evidence citations.';
    return `<section class="graph--qr" aria-label="QR investigation board"><div class="qr-board-toolbar"><span>${count===events.length?'LIVE TRACE':'SAVED EVENT REPLAY'} · ${count}/${events.length}</span><div><button class="button quiet small" data-qr-zoom="out" aria-label="Zoom out QR graph">−</button><button class="button quiet small" data-qr-zoom="in" aria-label="Zoom in QR graph">+</button><button class="button quiet small" data-qr-zoom="fit">Fit board</button><button class="button secondary small" data-qr-replay="start" ${events.length?'':'disabled'}>Replay</button><button class="button quiet small" data-qr-replay="live">Live</button></div></div><div class="qr-board-viewport" data-scroll="qr-board" tabindex="0" aria-label="Investigation graph. Scroll to pan, use toolbar to zoom."><svg viewBox="0 0 ${width} 630" width="${Math.round(width*(options.zoom || .7))}" height="${Math.round(630*(options.zoom || .7))}" role="group" aria-label="Evidence through DataDNA to Marketplace, payments, decision and resolution"><defs><marker id="qr-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8fd3ff"/></marker><marker id="qr-arrow-unknown" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#29456b"/></marker><pattern id="qr-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#29456b"/></pattern></defs><rect width="${width}" height="630" fill="url(#qr-dots)"/>${frames}<g class="qr-edges">${edges}</g><g class="qr-nodes">${nodes}</g></svg></div><div class="qr-board-inspector" role="status">${inspector}</div><details class="qr-event-log"><summary>Investigation activity · ${count} saved events</summary><ol>${events.slice(0,count).map(e=>`<li><span>${escape(e.kind.replaceAll('_',' '))}</span><small>${escape(e.at)} · ${escape(e.actor)}</small><p>${escape(e.detail)}</p></li>`).join('')}</ol></details></section>`;
  }
  return {groups,links,reduce,render};
})();
