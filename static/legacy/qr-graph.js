/* QR topology and append-only event reducer. Independent of the Add money graph. */
"use strict";
window.QRGraph = (() => {
  const groups = [
    ["Evidence", [["receipt_received", "Receipt received"], ["receipt_scan", "Receipt scan"], ["annotated_fields", "Annotated fields"]]],
    ["Marketplace", [["purchase_lookup", "Purchase lookup"], ["order_match", "Order match"], ["amount_match", "Amount & item match"]]],
    ["Payments", [["qr_lookup", "QR transaction"], ["bank_debit", "Bank debit"], ["cash_claim", "Cash receipt claim"]]],
    ["Decision", [["legitimate", "Legitimate"], ["rejected", "Rejected"], ["uncertain", "Uncertain"]]],
    ["Resolution", [["refund_eligibility", "Refund eligibility"], ["refund_request", "Refund request"], ["refund_posted", "Refund posted"], ["customer_notification", "Customer notified"], ["human_handoff", "Human handoff"]]],
  ];
  const links = [["receipt_received","receipt_scan"],["receipt_scan","annotated_fields"],["annotated_fields","purchase_lookup"],
    ["purchase_lookup","order_match"],["order_match","amount_match"],["amount_match","qr_lookup"],
    ["qr_lookup","bank_debit"],["bank_debit","cash_claim"],["cash_claim","legitimate"],["cash_claim","rejected"],["cash_claim","uncertain"],
    ["legitimate","refund_eligibility"],["refund_eligibility","refund_request"],["refund_request","refund_posted"],
    ["refund_posted","customer_notification"],["rejected","customer_notification"],["uncertain","human_handoff"]];
  const labels = {unknown:"Not checked",active:"In progress",completed:"Completed",uncertain:"Needs review",rejected:"Conflict found",handoff:"Human review"};
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    const count=options.count ?? events.length;
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
    return `<section class="graph--qr" aria-label="QR investigation board"><div class="qr-board-toolbar"><span>${count===events.length?'LIVE TRACE':'SAVED EVENT REPLAY'} · ${count}/${events.length}</span><div><button class="button quiet small" data-qr-zoom="out" aria-label="Zoom out QR graph">−</button><button class="button quiet small" data-qr-zoom="in" aria-label="Zoom in QR graph">+</button><button class="button quiet small" data-qr-zoom="fit">Fit board</button><button class="button secondary small" data-qr-replay="start" ${events.length?'':'disabled'}>Replay</button><button class="button quiet small" data-qr-replay="live">Live</button></div></div><div class="qr-board-viewport" data-scroll="qr-board" tabindex="0" aria-label="Investigation graph. Scroll to pan, use toolbar to zoom."><svg viewBox="0 0 1200 630" width="${Math.round(1200*(options.zoom || .7))}" height="${Math.round(630*(options.zoom || .7))}" role="group" aria-label="Evidence to Marketplace to payments to decision to resolution"><defs><marker id="qr-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8fd3ff"/></marker><marker id="qr-arrow-unknown" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#29456b"/></marker><pattern id="qr-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#29456b"/></pattern></defs><rect width="1200" height="630" fill="url(#qr-dots)"/>${frames}<g class="qr-edges">${edges}</g><g class="qr-nodes">${nodes}</g></svg></div><div class="qr-board-inspector" role="status">${options.selected?`<strong>${escape(groups.flatMap(([,items])=>items).find(([id])=>id===options.selected)?.[1])}</strong><p>${escape(detail?.detail || (detail?'Saved '+detail.kind.replaceAll('_',' ').toLowerCase():'No saved check for this node.'))}</p>${detail?`<small>Event ${detail.sequence} · ${escape(detail.actor)} · Evidence v${detail.evidence_version}</small><div class="qr-citations">${(detail.evidence_ids||[]).map(id=>`<button class="button quiet small" data-evidence="${escape(id)}">View evidence ${escape(id.slice(-6))}</button>`).join('')}</div>`:''}`:'Select a node to inspect its saved events and evidence citations.'}</div><details class="qr-event-log"><summary>Investigation activity · ${count} saved events</summary><ol>${events.slice(0,count).map(e=>`<li><span>${escape(e.kind.replaceAll('_',' '))}</span><small>${escape(e.at)} · ${escape(e.actor)}</small><p>${escape(e.detail)}</p></li>`).join('')}</ol></details></section>`;
  }
  return {groups,links,reduce,render};
})();
