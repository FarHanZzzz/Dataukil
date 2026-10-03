"use strict";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const read = (k, f) => {
  try {
    return JSON.parse(sessionStorage.getItem(k)) ?? f;
  } catch {
    return f;
  }
};
const S = {
  tokens: read("tf.tokens", {}),
  drafts: read("tf.drafts", {}),
  sim: null,
  sims: [],
  customerCase: null,
  staffCase: null,
  cases: [],
  phone: "flow",
  customerTab: "summary",
  staffTab: "overview",
  view: "both",
  filter: "live",
  profile: "confirmed",
  busy: {},
  pending: new Map(Array.isArray(read("tf.pending", [])) ? read("tf.pending", []) : []),
  polling: false,
  ready: false,
  staffRole: "staff",
  selectedTask: null,
  selectedEvidence: null,
  file: null,
  modal: null,
  qrZoom: .7,
  qrReplay: null,
  qrSelected: null,
  qrAnimation: null,
  receiptFile: null,
  basket: read('tf.basket', [['Rice, 1 kg',80],['Milk, 500 ml',50],['Eggs, 4 pieces',48],['Bread, one loaf',45],['Bananas, 4 pieces',32],['Potatoes, 1 kg',40],['Tomatoes, 500 g',35],['Yoghurt, 100 g',30],['Cooking oil, 500 ml',140]].map(([description,price])=>({description,quantity:'1',price:price.toFixed(2)}))),
  qrAmountEdited: read('tf.qrAmountEdited',false),
};
const money = (n) =>
  n == null
    ? "Not established"
    : new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency: "BDT",
        maximumFractionDigits: 2,
      }).format(n / 100);
const amount = (n) => (n / 100).toFixed(2);
const date = (v) =>
  v
    ? new Intl.DateTimeFormat("en-GB", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Dhaka",
      }).format(new Date(v))
    : "Not scheduled";
const clock = (v) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(v ? new Date(v) : new Date());
const future = () =>
  new Date(Date.now() + 86400000 + 21600000).toISOString().slice(0, 16);
const actorName = (a) =>
  ({
    staff_1: "Investigator 1",
    staff_2: "Investigator 2",
    customer_1: "Customer",
    customer_2: "Customer 2",
  })[a] || a;
const statusName = (s) =>
  ({
    OPEN: "In review",
    WAITING_EVIDENCE: "Awaiting evidence",
    REVIEWED: "Evidence reviewed",
    ESCALATED: "Further review",
    OUTCOME_RECORDED: "Outcome recorded",
  })[s] || s;
const paths = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  activity: "M4 6h16M4 12h16M4 18h10",
  chat: "M4 4h16v12H9l-5 4z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  check: "m5 12 4 4L19 6",
  shield: "M12 3 4 6v7c0 4 8 8 8 8s8-4 8-8V6z m-4 9 3 3 5-6",
  receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2z M9 8h6M9 12h6",
  scan: "M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5 M7 7h4v4H7zM14 7h3M14 11h3M7 14h4v3H7zM14 14h3v3",
  alert: "M12 3 2 21h20z M12 9v5M12 17v1",
  send: "m3 3 18 9-18 9 4-9z M7 12h14",
  plus: "M12 4v16M4 12h16",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 5 5",
  refresh: "M20 8a9 9 0 0 0-15-3L3 8m0-5v5h5M4 16a9 9 0 0 0 15 3l2-3m0 5v-5h-5",
  file: "M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h6",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3c0-4 14-4 14 0v3M17 4c4 0 4 7 0 7M18 15c4 0 4 4 4 6",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  cash: "M3 6h18v12H3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 9v6M18 9v6",
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const pill = (t, k = "neutral") => `<span class="pill ${k}">${esc(t)}</span>`;
const disabled = (r) => (S.busy[r] ? ' disabled aria-busy="true"' : "");
const d = (form, key, fallback = "") => S.drafts[form]?.[key] ?? fallback;
const field = (form, key, label, fallback = "", type = "text", extra = "") =>
  `<label class="field" for="${form}-${key}"><span>${label}</span><input id="${form}-${key}" aria-label="${esc(label)}" name="${key}" type="${type}" value="${esc(d(form, key, fallback))}" ${extra}></label>`;
const textarea = (form, key, label, fallback = "", extra = "") =>
  `<label class="field" for="${form}-${key}"><span>${label}</span><textarea id="${form}-${key}" aria-label="${esc(label)}" name="${key}" ${extra}>${esc(d(form, key, fallback))}</textarea></label>`;
const note = (t, k = "info") =>
  `<div class="note ${k}">${icon(k === "warning" ? "alert" : "shield")}<p>${t}</p></div>`;
function toast(text, error = false) {
  const el = $("#feedback");
  el.hidden = false;
  el.className = "toast" + (error ? " error" : "");
  el.textContent = text;
  clearTimeout(S.toastTimer);
  S.toastTimer = setTimeout(() => (el.hidden = true), error ? 14000 : 6000);
}
function minor(value, allowZero = false) {
  const v = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v))
    throw Error("Enter a positive amount with at most two decimal places.");
  const [whole, dec = ""] = v.split(".");
  const n = Number(whole) * 100 + Number(dec.padEnd(2, "0"));
  if (n < (allowZero?0:1) || n > 100000000)
    throw Error("Amount must be between ৳0.01 and ৳1,000,000.");
  return n;
}
async function api(role, path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(S.tokens[role]?.token
      ? { "X-TraceFix-Session": S.tokens[role].token }
      : {}),
    ...options.headers,
  };
  let r;
  try {
    r = await fetch("/api" + path, { ...options, headers });
  } catch {
    throw Error(
      "Connection interrupted. Your saved progress is safe. Retry when the server is available.",
    );
  }
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error(
      "The server response could not be read. Refresh to check your saved progress.",
    );
  }
  if (!r.ok) {
    const error = Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form fields and try again.",
    );
    error.status = r.status;
    throw error;
  }
  return data;
}
async function ensureSession(role, force = false) {
  if (S.tokens[role]?.token && !force) {
    try {
      const session = await api(role, "/session");
      if (session.role === (role === "customer" ? "customer" : "staff")) {
        if (role === "staff")
          S.staffRole = session.actor === "staff_2" ? "other_staff" : "staff";
        return;
      }
    } catch {}
  }
  S.tokens[role] = await api(null, "/session", {
    method: "POST",
    body: JSON.stringify({ role: role === "staff" ? S.staffRole : role }),
  });
  sessionStorage.setItem("tf.tokens", JSON.stringify(S.tokens));
}
async function mutate(role, path, body) {
  const signature =
    role + path + JSON.stringify({ ...body, version: undefined });
  let pending = S.pending.get(signature);
  if (!pending) {
    pending = { id: crypto.randomUUID(), body };
    S.pending.set(signature, pending);
    sessionStorage.setItem("tf.pending", JSON.stringify([...S.pending]));
  }
  try {
    const result = await api(role, path, {
      method: "POST",
      body: JSON.stringify(pending.body),
      headers: { "Idempotency-Key": pending.id },
    });
    S.pending.delete(signature);
    sessionStorage.setItem("tf.pending", JSON.stringify([...S.pending]));
    return result;
  } catch (e) {
    if (e.status && e.status < 500) {
      S.pending.delete(signature);
      sessionStorage.setItem("tf.pending", JSON.stringify([...S.pending]));
    }
    throw e;
  }
}
function focusSelector(node){
  if(node.id)return '#'+CSS.escape(node.id);
  const key=['data-action','data-modal','data-check','data-qr-action','data-qr-verdict','data-qr-section','data-qr-zoom','data-qr-node','data-staff-tab','data-customer-tab','data-phone-nav','data-qr-replay'].find(key=>node.hasAttribute(key));
  return key?`[${key}="${CSS.escape(node.getAttribute(key))}"]`:null;
}
function snapshot(el) {
  return {
    focus: el.contains(document.activeElement)
      ? {
          id: document.activeElement.id,
          selector:focusSelector(document.activeElement),
          start: document.activeElement.selectionStart,
          end: document.activeElement.selectionEnd,
        }
      : null,
    scroll: [...el.querySelectorAll("[data-scroll]")].map((n) => ({
      key: n.dataset.scroll,
      top: n.scrollTop,
      left:n.scrollLeft,
      bottom: n.scrollHeight - n.scrollTop - n.clientHeight < 35,
    })),
  };
}
function restore(el, s) {
  for (const old of s.scroll) {
    const n = el.querySelector(`[data-scroll="${old.key}"]`);
    if(n)n.scrollLeft=old.left||0;
    if (n)
      n.scrollTop =
        old.key === "thread" && old.bottom ? n.scrollHeight : old.top;
  }
  if (s.focus?.selector) {
    const n = el.querySelector(s.focus.selector)||el.querySelector('.qr-primary-stage .button:not([disabled])');
    if (n && el.contains(n)) {
      n.focus({ preventScroll: true });
      try {
        n.setSelectionRange(s.focus.start, s.focus.end);
      } catch {}
    }
  }
}
function update(el, html) {
  const s = snapshot(el);
  const readers=[...el.querySelectorAll('.qr-reader')],focused=document.activeElement;
  const evidence=el.querySelector('#qr-evidence');
  const pinned=evidence?.dataset.taskKey===QRReceipt.currentAnimationKey()?evidence:null;
  el.innerHTML = html;
  const nextEvidence=el.querySelector('#qr-evidence');
  if(pinned&&nextEvidence?.dataset.taskKey===pinned.dataset.taskKey)nextEvidence.replaceWith(pinned);
  for(const reader of readers){
    const replacement=[...el.querySelectorAll('.qr-reader')].find(n=>n.dataset.readerKey===reader.dataset.readerKey);
    if(replacement)replacement.replaceWith(reader);
  }
  restore(el, s);
  if(el.contains(focused))focused.focus({preventScroll:true});
}
function clearDraft(form) {
  delete S.drafts[form];
  sessionStorage.setItem("tf.drafts", JSON.stringify(S.drafts));
}
function journeyURL(view=S.view) {
  const params=new URLSearchParams();
  if(S.sim) params.set("simulation",S.sim.id);
  const caseId=S.customerCase?.id || S.staffCase?.id;
  if(caseId) params.set("case",caseId);
  params.set("view",view==="phone"?"customer":view==="desk"?"operator":"both");
  return "/qr-demo?"+params;
}
function rememberSelection(push=true) {
  if(S.sim) localStorage.setItem("tf.activeSim",S.sim.id);
  if(S.customerCase) localStorage.setItem("tf.activeCase",S.customerCase.id);
  const url=journeyURL();
  if(location.pathname+location.search!==url) history[push?"pushState":"replaceState"]({},"",url);
  updateJourneyLinks();
}
function canonicalView(view) { return view === "customer" ? "phone" : view === "operator" ? "desk" : view; }
function updateJourneyLinks() {
  document.querySelectorAll("a[data-view]").forEach(a=>a.href=journeyURL(a.dataset.view));
  document.querySelectorAll(".companion-link,.qr-companion").forEach(a=>a.href=journeyURL("desk"));
}
function setView(view,persist=false) {
  view=canonicalView(view);S.view=["both","phone","desk"].includes(view)?view:"both";
  $("#workspace").className="workspace view-"+S.view;
  document.querySelectorAll("[data-view]").forEach(n=>{
    n.classList.toggle("active",n.dataset.view===S.view);
    if(n.tagName==="BUTTON") n.setAttribute("aria-pressed",String(n.dataset.view===S.view));
  });
  if(persist)rememberSelection();
  updateJourneyLinks();
}
function renderJourney() {
  const sim = S.sim,
    c = S.customerCase;
  let at = !sim
    ? 0
    : sim.stage === "PURCHASE_CREATED"
      ? 1
      : sim.stage === "QR_UNCLEAR"
        ? 2
        : sim.stage === "SECOND_PAID" || sim.stage === "QR_CONFIRMED"
          ? 3
          : sim.stage === "RECEIPT_ATTACHED"
            ? 4
            : 5;
  const pipe=S.staffCase?.id===c?.id?S.staffCase?.qr_pipeline:null;
  if(pipe?.receipt_scan && pipe.receipt_scan.evidence_version===S.staffCase.evidence_version)at=6;
  if(pipe?.marketplace && pipe.marketplace.status!=='STALE' && pipe.marketplace.evidence_version===S.staffCase.evidence_version)at=7;
  if(pipe?.verdict?.status==='RECORDED' && pipe.verdict.evidence_version===S.staffCase?.evidence_version || c?.qr_pipeline?.verdict)at=8;
  if(S.qrAnimation?.kind==="receipt_scan")at=5;
  if(S.qrAnimation?.kind==="marketplace")at=6;
  const steps = [
    ["Purchase", "Prepare the order"],
    ["QR payment", "Pay on the phone"],
    ["Cash", "Receive the receipt"],
    ["Bank activity", "See the debit"],
    ["Complaint", "Attach evidence"],
    ["Scan", "AI annotates regions"],
    ["Marketplace", "Cross-check the order"],
    ["Verdict", "Refund or handoff"],
    ["Outcome", "Customer update"],
  ];
  $("#journey").innerHTML = steps
    .map(
      ([title, sub], i) =>
        `<div class="journey-step ${i === at ? "current" : i < at ? "complete" : ""}" ${i === at ? 'aria-current="step"' : ""}><span class="step-number">${i < at ? icon("check") : String(i + 1).padStart(2, "0")}</span><div><strong>${title}</strong><small>${sub}</small></div>${i < steps.length - 1 ? '<span class="step-connector"></span>' : ""}</div>`,
    )
    .join("");
  const labels = ["Start with the purchase", "Customer is paying by QR", "Customer is paying cash", sim?.customer_observed_debit?"Bank debit observed · attach receipt":"Check later bank activity", "File the complaint with receipt evidence", "Operator is scanning receipt evidence", "Review receipt fields, then verify with Marketplace", "Operator is reviewing the verdict", c?.qr_pipeline?.verdict?.outcome==="UNCERTAIN"?"Human review continues · automation paused":c?.qr_pipeline?.resolution?.state==="REFUND_COMPLETED"?"Simulated refund completed":c?.qr_pipeline?.resolution?.state==="REFUND_REQUESTED"?"Refund requested · completion pending":c?.qr_pipeline?.verdict?.outcome==="LEGITIMATE"?"Refund proposed · operator approval required":"Review explanation shared with customer"];
  const banner = document.querySelector("#current-stage");
  if (banner && !S.qrAnimation) banner.innerHTML = `<span class="qr-stage-kicker">CURRENT STAGE</span><strong>${esc(labels[Math.min(at, labels.length - 1)])}</strong><span>${sim ? `${esc(sim.merchant)} · ${esc(sim.purchase_id)}` : "Create a purchase to begin"}</span>`;
}
function phoneTitle(title, sub = "", back = false) {
  $("#phone-header").innerHTML =
    `${back ? `<button class="icon-button" data-action="phone-back" aria-label="Back">${icon("back")}</button>` : '<span class="wallet-mark">D↗</span>'}<div><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</div><span class="avatar">${esc((S.sim?.customer_name || "You").slice(0, 1))}</span>`;
}
function renderPhone() {
  const el = $("#phone-content"),
    previous = el.scrollTop,
    sim = S.sim,
    c = S.customerCase;
  const route = [
    S.phone,
    sim?.stage,
    c?.id,
    S.phone === "case" ? S.customerTab : "",
  ].join(":");
  const routeChanged = S.phoneRoute !== route;
  S.phoneRoute = route;
  const isCase = S.phone === "case" && c;
  phoneTitle(
    isCase
      ? "Support center"
      : S.phone === "activity"
        ? "Your activity"
        : S.phone === "cases"
          ? "Your support"
          : "DataUkil wallet",
    isCase ? c.reference : "FICTIONAL WALLET",
    S.phone === "report" || isCase,
  );
  let html = "";
  if (S.phone === "purchase" || (!sim && S.phone === "flow"))
    html = purchaseScreen();
  else if (S.phone === "activity") html = activityScreen();
  else if (S.phone === "cases") html = casesScreen();
  else if (S.phone === "report" && sim) html = reportScreen();
  else if (isCase) html = customerScreen(c);
  else if (sim?.stage === "COMPLAINT_FILED" && c) {
    S.phone = "case";
    html = customerScreen(c);
  } else if (sim) html = paymentScreen(sim);
  else html = purchaseScreen();
  update(el, html);
  el.scrollTop = routeChanged ? 0 : previous;
  if (routeChanged && S.ready) {
    $(".customer-surface").scrollIntoView({ block: "start" });
    const thread = el.querySelector(".message-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }
  const active =
    S.phone === "activity"
      ? "activity"
      : ["case", "cases", "report"].includes(S.phone)
        ? "support"
        : "home";
  $("#phone-nav").innerHTML = [
    ["home", "home", "Home"],
    ["activity", "activity", "Activity"],
    ["support", "chat", "Support"],
  ]
    .map(
      ([id, ic, title]) =>
        `<button data-phone-nav="${id}" class="${active === id ? "active" : ""}" ${active === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${title}</span>${id === "support" && c?.requests?.some((t) => t.status === "OPEN") ? '<i class="notification-dot"></i>' : ""}</button>`,
    )
    .join("");
  $("#customer-presence").textContent =
    S.busy.customer || "Your side of the counter";
}
function basketTotal(){return S.basket.reduce((sum,row)=>sum+minor(row.price)*Number(row.quantity),0)+minor(S.drafts.purchase?.tax_minor||'0',true);}
function purchaseScreen() {
  const saved=S.sims.find(sim=>sim.id===localStorage.getItem("tf.activeSim"));
  let total=50000;try{total=basketTotal();}catch{}
  return `${saved?`<section class="qr-resume"><strong>A saved journey is available</strong><p>${esc(saved.merchant)} · ${money(saved.total_minor)}</p><button class="button secondary full" data-resume-sim="${esc(saved.id)}">Resume saved journey ${icon("arrow")}</button></section>`:""}<div class="app-kicker">START NEW SCENARIO</div><h2>A purchase,<br>in your hands.</h2><p class="app-description">Build your basket, attempt QR, then follow the receipt into investigation.</p><form id="purchase-form" data-draft="purchase" class="app-form">
 ${field("purchase", "customer_name", "Your name", "Farhan", "text", 'required maxlength="80" autocomplete="given-name"')}
 ${field("purchase", "merchant", "Merchant name", "FreshMart Demo", "text", 'required maxlength="100"')}
 ${field("purchase", "merchant_address", "Merchant address", "Dhaka, Bangladesh", "text", 'maxlength="160"')}
 <details class="qr-basket"><summary><strong>Your basket · ${S.basket.length} items</strong><span>Edit items, quantities and prices</span></summary><div class="section-heading"><h3>Itemized purchase</h3><span>Synthetic prices</span></div>${S.basket.map((row,i)=>`<div class="qr-basket-item"><label class="field"><span>Item ${i+1}</span><input id="basket-description-${i}" name="basket-description-${i}" data-basket="description" data-index="${i}" value="${esc(row.description)}" required maxlength="80"></label><div class="qr-basket-prices"><label class="field"><span>Quantity</span><input id="basket-quantity-${i}" name="basket-quantity-${i}" data-basket="quantity" data-index="${i}" type="number" min="1" max="99" step="1" value="${esc(row.quantity)}" required></label><label class="field"><span>Unit price (৳)</span><input id="basket-price-${i}" name="basket-price-${i}" data-basket="price" data-index="${i}" inputmode="decimal" value="${esc(row.price)}" required></label><button type="button" class="button quiet small" data-basket-remove="${i}" aria-label="Remove item ${i+1}" ${S.basket.length===1?'disabled':''}>×</button></div><div class="qr-basket-line"><span>Line total</span><output data-basket-line="${i}">${(()=>{try{return money(minor(row.price)*Number(row.quantity));}catch{return 'Check amount';}})()}</output></div></div>`).join('')}<button type="button" class="button secondary full" data-basket-add ${S.basket.length>=20?'disabled':''}>Add item</button></details>
 ${field('purchase','tax_minor','Tax (৳, optional)','0.00','text','inputmode="decimal"')}
 <dl class="receipt-rows"><div><dt>Subtotal</dt><dd id="basket-subtotal">${money(total-(Number(S.drafts.purchase?.tax_minor||0)*100))}</dd></div><div><dt>Invoice total</dt><dd id="basket-total">${money(total)}</dd></div></dl>
 ${field("purchase", "qr_amount_minor", "QR payment (৳)", amount(total), "text", 'required inputmode="decimal"')}
 <details class="qr-presenter"><summary>Presenter scenario setup</summary><p class="field-hint">Choose source behavior before starting. Hidden from operator checks.</p><label class="field"><span>Scenario</span><select id="purchase-profile">${[["confirmed","Matching purchase and payment records"],["denied","Marketplace denies the cash claim"],["unverified","Marketplace is unavailable"],["qr_failed","Bank record needs human review"]].map(([id,title])=>`<option value="${id}" ${S.profile===id?"selected":""}>${title}</option>`).join('')}</select></label></details><p class="form-error" id="purchase-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Start new scenario"} ${icon("arrow")}</button>
 </form><div class="app-security">${icon("shield")}A safe simulation. No real money is used.</div>`;
}
function merchantCard(sim) {
  return `<div class="merchant-card"><span class="merchant-icon">${icon("receipt")}</span><div><strong>${esc(sim.merchant)}</strong><small>${esc(sim.item)}</small></div>${pill("Purchase", "green")}</div>`;
}
function receiptRows(sim) {
  return `<dl class="receipt-rows"><div><dt>Invoice total</dt><dd>${money(sim.total_minor)}</dd></div><div><dt>Purchase reference</dt><dd class="mono">${esc(sim.purchase_id)}</dd></div><div><dt>QR reference</dt><dd class="mono">${esc(sim.qr_reference)}</dd></div></dl>`;
}
function paymentScreen(sim) {
  if (sim.stage === "PURCHASE_CREATED")
    return `<div class="app-kicker">PAYMENT · STEP 02</div><h2>Pay ${esc(sim.merchant)}.</h2><p class="app-description">Your purchase is ready. Try the fictional QR payment.</p>${merchantCard(sim)}<div class="qr-checkout"><img src="${sim.qr_image}" width="182" height="182" alt="QR containing the fictional reference ${esc(sim.qr_reference)}"><span class="qr-caption">DEMO PAYMENT CODE</span><strong>${money(sim.qr_amount_minor)}</strong><span class="mono">${esc(sim.qr_reference)}</span></div>${receiptRows(sim)}<button class="button primary full" data-action="attempt-qr"${disabled("customer")}>${S.busy.customer || "Pay by QR"} ${icon("scan")}</button><p class="center-hint">This QR contains a demo reference, not a payable wallet link.</p>`;
  if (sim.stage === "QR_UNCLEAR")
    return `<div class="result-symbol red">${icon("alert")}</div><div class="app-kicker">QR PAYMENT · NO CONFIRMATION</div><h2>The payment failed on screen.</h2><p class="app-description">The app did not confirm the QR payment. Continue with cash and keep the receipt. A later bank activity update may still show a debit.</p>${merchantCard(sim)}${note("The phone result and the eventual bank record are separate facts. This screen does not prove whether money moved.", "warning")}<form id="cash-form" data-draft="cash-${sim.id}" class="app-form">${field("cash-" + sim.id, "amount_minor", "Cash paid at the counter (৳)", amount(sim.total_minor === sim.qr_amount_minor ? sim.total_minor : sim.total_minor - sim.qr_amount_minor), "text", 'required inputmode="decimal"')}<p class="form-error" id="cash-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Pay cash and get receipt"} ${icon("cash")}</button></form>`;
  if (sim.stage === "SECOND_PAID" || (sim.stage === "QR_CONFIRMED" && sim.cash_amount_minor))
    return `<div class="result-symbol ${sim.customer_observed_debit ? "amber" : "green"}">${icon(sim.customer_observed_debit ? "alert" : "cash")}</div><div class="app-kicker">${sim.customer_observed_debit ? "BANK ACTIVITY · DEBIT OBSERVED" : "CASH PAID · RECEIPT ISSUED"}</div><h2>${sim.customer_observed_debit ? "Your bank still shows a debit." : "Your cash payment is saved."}</h2><p class="app-description">${sim.customer_observed_debit ? "Attach the receipt as evidence before filing your complaint." : "The merchant issued a receipt. Next, check your bank activity for the original QR amount."}</p>${merchantCard(sim)}<div class="payment-tile"><span>${icon("cash")}</span><div><strong>Cash payment recorded</strong><small>Merchant receipt issued · customer report</small></div><b>${money(sim.cash_amount_minor)}</b></div>${sim.issued_receipt?`<figure class="qr-phone-receipt"><img src="data:${sim.issued_receipt.mime};base64,${sim.issued_receipt.base64}" alt="Synthetic cash receipt for this exact purchase"><figcaption>Receipt issued at the counter · synthetic</figcaption></figure><button type="button" class="button secondary full" data-customer-receipt="issued">View receipt ${icon("receipt")}</button>`:"<p>The original receipt is unavailable. Upload your receipt as evidence.</p>"}${sim.customer_observed_debit ? `<section class="qr-observed-debit"><span class="app-kicker">BANK ACTIVITY · CUSTOMER OBSERVED</span><h3>−${money(sim.qr_amount_minor)}</h3><p>Original QR reference: ${esc(sim.qr_reference)}. The operator still needs to check the bank record.</p></section>${receiptAttachScreen(sim)}` : `<button class="button primary full" data-action="observe-debit"${disabled("customer")}>${S.busy.customer || "View later bank activity"} ${icon("refresh")}</button>`}${sim.qr_status === "UNCLEAR" ? '<button class="button quiet full" data-action="refresh-qr">Check QR status (secondary)</button>' : ""}`;
  if (sim.stage === "RECEIPT_ATTACHED")
    return `<div class="result-symbol amber">${icon("receipt")}</div><div class="app-kicker">BANK DEBIT OBSERVED · RECEIPT READY</div><h2>Your bank still shows a debit.</h2><p class="app-description">Attach the receipt as evidence and file the complaint. The operator will compare the receipt, bank record, and Marketplace order.</p>${merchantCard(sim)}<div class="payment-tile"><span>${icon("scan")}</span><div><strong>QR screen</strong><small>Failed / no confirmation</small></div><b>${money(sim.qr_amount_minor)}</b></div><div class="payment-tile"><span>${icon("receipt")}</span><div><strong>Receipt evidence</strong><small>Attached for operator review</small></div><b>READY</b></div>${receiptDraftPreview(sim)}<button class="button primary full" data-action="report">File complaint with receipt ${icon("arrow")}</button>`;
  const complete = sim.qr_status === "COMPLETED";
  return `<div class="result-symbol ${complete ? "amber" : "green"}">${icon(complete ? "receipt" : "check")}</div><div class="app-kicker">PAYMENT STATUS UPDATED</div><h2>${complete && sim.cash_amount_minor ? "One purchase.<br>Two payment entries." : complete ? "Your QR payment completed." : "The QR did not complete."}</h2><p class="app-description">${complete ? "The provider’s fictional record now shows the QR payment completed." : "The fictional provider records no completed QR payment."} ${sim.cash_amount_minor ? "Your cash entry is also saved. An investigator can check how the records fit together." : ""}</p>${merchantCard(sim)}<div class="payment-tile"><span>${icon("scan")}</span><div><strong>QR · ${complete ? "Completed" : "Not completed"}</strong><small>${esc(sim.qr_reference)}</small></div><b>${money(complete ? sim.qr_amount_minor : 0)}</b></div>${sim.cash_amount_minor ? `<div class="payment-tile"><span>${icon("cash")}</span><div><strong>Cash · Reported</strong><small>Merchant confirmation still needed</small></div><b>${money(sim.cash_amount_minor)}</b></div>` : ""}${receiptRows(sim)}${sim.cash_amount_minor ? `<button class="button primary full" data-action="report">Report paying twice ${icon("arrow")}</button>` : `<button class="button primary full" data-action="new-purchase">Start another purchase ${icon("plus")}</button>`}<button class="button secondary full" data-phone-nav="activity">View payment timeline</button>`;
}
function defaultComplaint(sim) {
  return `I tried to pay ${money(sim.qr_amount_minor)} by QR at ${sim.merchant}, but the result was unclear. I then paid ${money(sim.cash_amount_minor)} cash for ${sim.item}, purchase ${sim.purchase_id}. Please check whether I paid twice for the same purchase.`;
}
function reportScreen() {
  const sim = S.sim,
    form = "report-" + sim.id;
  return `<div class="app-kicker">CUSTOMER WORKFLOW · FINAL STEP</div><h2>File the complaint.</h2><p class="app-description">Your receipt is attached as customer evidence. The operator will review it against the bank and Marketplace records.</p><div class="report-summary"><span>${icon("receipt")}</span><div><strong>${esc(sim.merchant)}</strong><small>QR ${money(sim.qr_amount_minor)} + cash ${money(sim.cash_amount_minor)}</small><small class="mono">${esc(sim.purchase_id)}</small></div></div><div class="receipt-ready"><span>${icon("check")}</span><div><strong>Receipt evidence attached</strong><small>${esc(sim.receipt_draft?.transcript || "Synthetic receipt ready for review")}</small></div></div><form id="report-form" data-draft="${form}" class="app-form">${textarea(form, "description", "Your complaint", defaultComplaint(sim), 'required maxlength="4000" rows="6"')}${textarea(form, "receipt_text", "Add a note about the receipt (optional)", sim.receipt_draft?.transcript || "", 'maxlength="4000" rows="3"')}<p class="field-hint">English, Bangla and Banglish are welcome. A receipt is evidence for review, not proof by itself.</p><p class="form-error" id="report-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Submit complaint"} ${icon("arrow")}</button></form>${note("Submitting a complaint opens the operator workflow. It does not move or refund money.")}`;
}
function activityScreen() {
  const sim = S.sim;
  return `<div class="app-kicker">YOUR PAYMENT STORY</div><h2>Every step, saved.</h2><p class="app-description">Your current purchase and its actual events.</p>${sim ? `${merchantCard(sim)}${receiptRows(sim)}<ol class="mobile-timeline">${sim.events.map((e) => `<li><span class="timeline-dot"></span><small>${date(e.at)}</small><p>${esc(e.text)}</p></li>`).join("")}</ol><button class="button primary full" data-action="resume">${sim.case_id ? "Open your complaint" : "Continue this purchase"} ${icon("arrow")}</button>` : `<div class="phone-empty">${icon("receipt")}<h3>No purchase yet</h3><p>Enter your details on Home to start.</p><button class="button primary full" data-action="new-purchase">Create a purchase</button></div>`}`;
}
function casesScreen() {
  const rows = S.customerCases || [];
  return `<div class="app-kicker">SUPPORT THAT STAYS WITH YOU</div><h2>Your complaints.</h2><p class="app-description">Return to a saved case or continue your current purchase.</p>${S.sim && !S.sim.case_id ? '<button class="button primary full" data-action="resume">Continue this purchase ' + icon("arrow") + "</button>" : ""}<div class="mobile-case-list">${rows.map((c) => `<button class="mobile-case" data-customer-case="${esc(c.id)}"><div><strong>${esc(c.purchase_label)}</strong><span class="mono">${esc(c.reference)}</span><small>${esc(c.next_step)}</small></div>${pill(statusName(c.status), c.status === "OUTCOME_RECORDED" ? "green" : "neutral")}${icon("arrow")}</button>`).join("") || '<div class="phone-empty">No complaints yet. Start with a purchase on Home.</div>'}</div><button class="button secondary full" data-action="new-purchase">New purchase ${icon("plus")}</button>`;
}
function assessmentCard(a, phone = false, stale = false) {
  if (!a && S.busy.staff === "Reading current evidence…")
    return `<div class="assessment pending"><div class="assessment-label">${icon("spark")} EVIDENCE CHECK IN PROGRESS</div><h3>Reading the saved evidence…</h3><p>You can still send a message while the check runs. Any new evidence requires a fresh assessment.</p></div>`;
  if (!a)
    return `<div class="assessment pending"><div class="assessment-label">${icon("spark")} ${stale ? "ASSESSMENT NEEDS AN UPDATE" : "EVIDENCE ASSESSMENT"}</div><h3>${stale ? "New evidence is ready to review." : "Your complaint is ready for review."}</h3><p>${phone ? "Your investigator will check the payment and merchant records." : "Run the assessment on the evidence currently saved in this case."}</p></div>`;
  const tone = {
    SUPPORTED: "green",
    REPAID: "green",
    NEEDS_EVIDENCE: "amber",
    CONFLICTING: "amber",
    NOT_SUPPORTED: "neutral",
  }[a.status];
  return `<div class="assessment ${tone}"><div class="assessment-label">${icon("spark")} ${phone ? "EVIDENCE CHECK" : "AI + SOURCE EVIDENCE CHECK"}</div><h3>${esc(a.headline)}</h3><p>${esc(a.summary)}</p>${!phone && a.evidence_ids?.length ? `<div class="citations">${a.evidence_ids.map((id, i) => `<button data-evidence="${esc(id)}" title="Open supporting record">Record ${i + 1} ${icon("arrow")}</button>`).join("")}</div>` : ""}${a.missing?.length ? `<div class="missing-evidence"><strong>What is still needed</strong>${a.missing.map((t) => `<p>${icon("plus")}${esc(t)}</p>`).join("")}</div>` : ""}</div>`;
}
function tabs(list, selected, attr) {
  return `<div class="tabs" role="tablist" aria-label="${attr.includes("customer") ? "Customer" : "Investigator"} case tabs">${list.map(([id, t]) => `<button id="${attr.replace("data-", "")}-${id}" role="tab" tabindex="${id === selected ? 0 : -1}" aria-selected="${id === selected}" class="${id === selected ? "active" : ""}" ${attr}="${id}">${t}</button>`).join("")}</div>`;
}
function customerScreen(c) {
  let body = "";
  const pending =
    c.requests?.filter((t) => ["OPEN", "RESPONDED"].includes(t.status)) || [];
  const qrOutcome = c.qr_pipeline?.verdict ? `<div class="customer-qr-outcome ${String(c.qr_pipeline.verdict.outcome).toLowerCase()}"><span class="app-kicker">OPERATOR OUTCOME</span><h3>${esc(c.qr_pipeline.verdict.outcome === "LEGITIMATE" ? "Legitimate duplicate · refund review" : c.qr_pipeline.verdict.outcome === "REJECTED" ? "Rejected after source review" : "Uncertain · human review continues")}</h3><p>${esc(c.qr_pipeline.verdict.reason || (c.qr_pipeline.verdict.outcome === "LEGITIMATE" ? "A simulated refund requires operator approval." : c.qr_pipeline.verdict.outcome === "REJECTED" ? "No refund was created." : "Automation paused and an investigator owns the next step."))}</p>${c.qr_pipeline.resolution?.state === "REFUND_COMPLETED" ? '<strong class="qr-success-label">Simulated refund completed</strong>' : ""}</div>` : "";
  if(c.workflow==="qr_cash" && S.customerTab==="summary")body=qrCustomerStatus(c);
  else if (S.customerTab === "summary")
    body = `${qrOutcome}<div class="case-status-card"><div>${pill(statusName(c.status), c.status === "OUTCOME_RECORDED" ? "green" : "neutral")}<span class="mono">${esc(c.reference)}</span></div><h3>${esc(c.purchase_label)}</h3><p>${esc(actorName(c.owner))} is responsible for your case.</p><div class="review-time">${icon("activity")}<span>Next review<strong>${date(c.next_review)} · Dhaka</strong></span></div></div>${c.status === "OUTCOME_RECORDED" && c.reviews?.some((r) => r.decision === "OUTCOME_RECORDED" && !r.stale) ? `<div class="customer-request final-review"><span class="app-kicker">YOUR INVESTIGATOR’S OUTCOME</span><p>${esc(c.reviews.filter((r) => r.decision === "OUTCOME_RECORDED" && !r.stale).at(-1).note)}</p><small>Saved ${date(c.reviews.filter((r) => r.decision === "OUTCOME_RECORDED" && !r.stale).at(-1).at)}</small></div>` : ""}${assessmentCard(c.assessment, true, c.analysis_state === "STALE")}${pending.map((t) => `<div class="customer-request"><span class="app-kicker">${t.status === "RESPONDED" ? "YOUR RESPONSE IS SAVED" : "YOUR INVESTIGATOR NEEDS YOU"}</span><p>${esc(t.question)}</p>${t.status === "OPEN" ? `<button class="button primary full" data-reply-task="${esc(t.id)}">Reply to request ${icon("chat")}</button>` : "<small>Your investigator will review your reply.</small>"}</div>`).join("")}<section class="phone-section"><h3>What’s confirmed</h3>${c.confirmed_facts.map((t) => `<p class="confirmed-line">${icon("check")}${esc(t)}</p>`).join("") || '<p class="muted">No payment facts have been confirmed by your investigator yet.</p>'}</section><section class="phone-section"><h3>Latest updates</h3>${c.notifications
      .slice(-4)
      .reverse()
      .map(
        (n) =>
          `<div class="customer-update"><small>${date(n.at)}</small><p>${esc(n.text)}</p></div>`,
      )
      .join(
        "",
      )}</section><button class="button secondary full" data-customer-tab="chat">Message your investigator ${icon("chat")}</button>`;
  if (S.customerTab === "chat") body = conversation(c, "customer");
  if (S.customerTab === "evidence")
    body = `<h3>Add something to your case.</h3><p class="app-description">A receipt, a reference or your recollection can help. Supplied files remain unverified until reviewed.</p><form id="upload-form" data-draft="upload-${c.id}" class="app-form"><label class="field" for="upload-file"><span>Receipt or document</span><input id="upload-file" name="file" type="file" accept="image/png,image/jpeg,text/plain" ${S.file ? "" : "required"}></label>${S.file ? `<p class="field-hint">Selected: ${esc(S.file.name)}</p>` : ""}${textarea("upload-" + c.id, "transcript", "Image transcript (required for images)", "", 'maxlength="4000" rows="4" placeholder="Type the visible wording. Text files are read directly."')}<p class="field-hint">PNG, JPEG or UTF-8 text · up to 2 MiB</p><p id="upload-error" class="form-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Add evidence"} ${icon("plus")}</button></form><section class="phone-section"><h3>Your saved evidence</h3>${c.evidence_receipts?.map((e) => `<div class="saved-receipt">${icon("file")}<div><small>${date(e.at)} · Supplied by customer</small><p>${esc(e.text)}</p></div></div>`).join("") || '<p class="muted">You haven’t supplied a document yet.</p>'}</section>`;
  return `${tabs(
    [
      ["summary", "Overview"],
      ["chat", "Messages"],
      ["evidence", "Evidence"],
    ],
    S.customerTab,
    "data-customer-tab",
  )}<div class="phone-case-body" role="tabpanel" aria-labelledby="customer-tab-${S.customerTab}">${body}</div>`;
}
function conversation(c, role) {
  const form = role + "-message-" + c.id,
    reply =
      role === "customer" && S.selectedTask
        ? c.requests.find((t) => t.id === S.selectedTask && t.status === "OPEN")
        : null;
  const messages = c.messages?.length
    ? c.messages
    : [
        {
          role: "customer",
          actor: c.customer_id || "customer_1",
          at: c.created_at,
          text:
            c.description ||
            "Your complaint was accepted. Your investigator will review the saved details.",
        },
      ];
  return `<div class="conversation"><div class="conversation-heading"><span class="live-dot"></span><div><strong>${role === "customer" ? actorName(c.owner) : esc(c.customer_name || "Customer")}</strong><small>Shared case conversation · saved to this case</small></div></div><div class="message-thread" data-scroll="thread">${messages.map((m) => `<div class="message ${m.role === role ? "mine" : "theirs"}"><span class="message-name">${m.role === "customer" ? "Customer" : esc(actorName(m.actor))}${m.task_id ? " · Evidence request" : ""}</span><div class="message-bubble">${esc(m.text)}</div><time>${date(m.at)}</time></div>`).join("")}</div>${reply ? `<div class="reply-context"><span>Replying to: ${esc(reply.question)}</span><button class="icon-button" data-action="clear-reply" aria-label="Stop replying to request">×</button></div>` : ""}<form id="${role}-message-form" data-draft="${form}" class="message-composer">${textarea(form, "text", role === "customer" ? "Message your investigator" : "Message the customer", "", 'required maxlength="4000" rows="2" placeholder="Write a message…"')}<button class="button primary send-button" type="submit" aria-label="Send ${role === "customer" ? "customer" : "investigator"} message"${disabled(role)}>${icon("send")}</button><p class="form-error" id="${role}-message-error" role="alert"></p></form>${role === "customer" ? '<p class="field-hint">Your reply is preserved as supplied evidence. Your investigator will review it.</p>' : ""}</div>`;
}
function renderDesk() {
  const c = S.staffCase;
  const route = [c?.id, S.staffTab, S.filter].join(":");
  const routeChanged = S.deskRoute !== route;
  S.deskRoute = route;
  let html = `<header class="desk-header"><span class="desk-brand">${icon("shield")}DataUkil <small>INVESTIGATIONS</small></span><label class="investigator-select"><span class="sr-only">Investigator identity</span><select id="staff-identity" aria-label="Investigator identity"${disabled("staff")}><option value="staff" ${S.staffRole === "staff" ? "selected" : ""}>Investigator 1</option><option value="other_staff" ${S.staffRole === "other_staff" ? "selected" : ""}>Investigator 2</option></select><span class="presence-dot"></span></label></header>`;
  if (!c) html += inbox();
  else
    html += `<div class="case-heading"><button class="button quiet small" data-action="inbox"${disabled("staff")}>${icon("back")} Inbox</button><div class="case-title"><div><p class="eyebrow">${esc(c.reference)} <span>/ ONE PURCHASE</span></p><h2>${esc(c.purchase_label || "Paid-twice investigation")}</h2></div>${pill(statusName(c.status), c.status === "OUTCOME_RECORDED" ? "green" : "neutral")}</div><div class="case-meta"><span>${icon("users")}${esc(c.customer_name || actorName(c.customer_id))}</span><span>Owner: <b>${esc(actorName(c.owner))}</b></span><span>Review: ${date(c.next_review)}</span></div></div>${tabs(
      [
        ["overview", "Overview"],
        [
          "conversation",
          "Conversation " +
            `<span class="tab-count">${c.messages?.length || 1}</span>`,
        ],
        [
          "evidence",
          "Evidence " + `<span class="tab-count">${c.evidence.length}</span>`,
        ],
        ["activity", "Activity"],
      ],
      S.staffTab,
      "data-staff-tab",
    )}<div class="desk-scroll" role="tabpanel" aria-labelledby="staff-tab-${S.staffTab}" data-scroll="desk">${S.staffTab === "overview" ? staffOverview(c) : S.staffTab === "conversation" ? conversation(c, "staff") : S.staffTab === "evidence" ? evidenceScreen(c) : staffActivity(c)}</div><div class="desk-footer"><span class="live-dot"></span><span>${S.qrAnimation?.label || S.busy.staff || "Saved in this workspace"} · Case v${c.version} · Evidence v${c.evidence_version}</span><button class="button quiet small" data-action="refresh">${icon("refresh")}Refresh</button></div>`;
  update($("#desk"), html);QRReceipt.mount($("#desk"));
  if (routeChanged) {
    const scroll = $("#desk .desk-scroll");
    if (scroll) scroll.scrollTop = 0;
    const thread = $("#desk .message-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }
}
function inbox() {
  const rows =
    S.filter === "live" ? S.cases.filter((c) => c.simulation_id) : S.cases;
  return `<div class="inbox-heading"><div><p class="eyebrow">YOUR WORKSPACE</p><h2>Investigation inbox <span>${rows.length}</span></h2></div><button class="icon-button" data-action="refresh" aria-label="Refresh cases">${icon("refresh")}</button></div><div class="inbox-filters"><button data-filter="live" class="${S.filter === "live" ? "active" : ""}">Live complaints</button><button data-filter="all" class="${S.filter === "all" ? "active" : ""}">All cases &amp; examples</button><span>Ordered by saved review time</span></div>${rows.length ? `<div class="inbox-list" data-scroll="desk">${rows.map((c) => `<button class="inbox-row" data-staff-case="${esc(c.id)}"><span class="inbox-avatar">${icon("receipt")}</span><div><strong>${esc(c.purchase_label || "Purchase " + c.purchase_id)}</strong><small class="mono">${esc(c.reference)}</small><p>${esc(c.facts.requirements[0] || "Evidence ready for investigator review.")}</p><small>${actorName(c.owner)} · ${date(c.next_review)}${c.overdue ? " · Review overdue" : ""}</small></div><div>${pill(statusName(c.status))}${pill(c.analysis_fresh ? "Assessment current" : "Needs assessment", c.analysis_fresh ? "green" : "amber")}</div>${icon("arrow")}</button>`).join("")}</div>` : `<div class="desk-empty"><div class="empty-illustration"><span>${icon("scan")}</span><i></i><span>${icon("chat")}</span><i></i><span>${icon("shield")}</span></div><p class="eyebrow">THE DESK IS READY</p><h3>Every complaint starts<br>with someone’s experience.</h3><p>Complete the purchase in the customer app and report the problem. The exact case will appear here, with the details you entered.</p><div class="empty-checklist"><span>${icon("check")}One linked purchase</span><span>${icon("check")}A saved conversation</span><span>${icon("check")}Evidence before an outcome</span></div><button class="button secondary" data-filter="all">Explore saved example cases ${icon("arrow")}</button></div>`}`;
}
function qrCustomerStatus(c){
  const p=c.qr_pipeline||{},verdict=p.verdict,resolution=p.resolution;
  return `<div class="app-kicker">COMPLAINT SAVED · ${esc(c.reference)}</div><h2>${resolution?.state==="REFUND_COMPLETED"?"Your simulated refund is complete.":verdict?.outcome==="REJECTED"?"Your complaint was reviewed.":verdict?.outcome==="UNCERTAIN"?"Human review continues.":"Your complaint is in review."}</h2><p class="app-description">${esc(actorName(c.owner))} owns this case. ${esc(c.next_step)}</p><div class="qr-status-facts"><article><span>QR screen result</span><strong>Failed / no confirmation</strong></article><article><span>Cash payment</span><strong>${money(c.reported_amount_minor)} · customer reported</strong></article><article><span>Bank activity</span><strong>Later debit observed by the customer</strong></article><article><span>Receipt evidence</span><strong>${c.evidence_receipts?.some(e=>e.mime?.startsWith("image/"))?"Attached for review":"Additional evidence requested"}</strong></article><article><span>Operator verdict</span><strong>${verdict?esc(verdict.outcome):"Awaiting investigation"}</strong></article><article><span>Refund</span><strong>${resolution?.state==="REFUND_COMPLETED"?"Simulated completion recorded":resolution?.state==="REFUND_REQUESTED"?"Approved request · awaiting completion":resolution?.state==="REFUND_PROPOSED"?"Proposed · operator approval required":verdict?.outcome==="REJECTED"?"No refund created":"No refund completed"}</strong></article></div>${verdict?`<section class="customer-qr-outcome ${verdict.outcome.toLowerCase()}"><h3>${verdict.outcome==="UNCERTAIN"?"Automation paused":verdict.outcome==="REJECTED"?"Review explanation":"Source review completed"}</h3><p>${esc(verdict.reason)}</p></section>`:""}${p.handoff?`<section class="qr-resolution-card handoff"><h3>Owned human follow-up</h3><p>${esc(actorName(c.owner))} · ${esc(p.handoff.queue)}</p><p>Next review: ${date(p.handoff.next_review)}</p></section>`:""}<section class="phone-section"><h3>What happens next</h3><p>${verdict?.outcome==="REJECTED"?"You can send further evidence for another review.":resolution?.state==="REFUND_COMPLETED"?"The synthetic refund completion is saved. No real money moved.":"Your investigator reviews the saved evidence and keeps the next step owned."}</p><button class="button secondary full" data-customer-tab="chat">Message your investigator</button></section><section class="phone-section"><h3>Recent updates</h3>${c.notifications.slice(-4).reverse().map(n=>`<div class="customer-update"><small>${date(n.at)}</small><p>${esc(n.text)}</p></div>`).join('')}</section>`;
}
function receiptDraftPreview(sim) {
  const draft=sim.receipt_draft;
  if(!draft)return "";
  return `<figure class="qr-phone-receipt"><img src="data:${draft.mime};base64,${draft.base64}" alt="Attached receipt original"><figcaption>Original receipt · unverified customer evidence</figcaption></figure><button type="button" class="button secondary full" data-customer-receipt="draft">View receipt ${icon("receipt")}</button><details><summary>Review receipt transcript</summary><p class="qr-transcript">${esc(draft.transcript)}</p></details>`;
}
function receiptAttachScreen(sim) {
  return `<section class="qr-receipt-attach"><h3>Attach your cash receipt</h3><p>The receipt is evidence for review. The operator must corroborate it.</p><button class="button primary full" data-action="attach-sample-receipt"${disabled("customer")}>Use sample receipt ${icon("receipt")}</button><details><summary>Upload your own receipt</summary><form id="receipt-draft-form" class="app-form" data-draft="receipt-${sim.id}"><label class="field"><span>Receipt image</span><input type="file" name="file" accept="image/png,image/jpeg" required></label>${textarea("receipt-"+sim.id,"transcript","Visible receipt wording","",'required maxlength="4000" rows="5"')}<p class="field-hint">PNG or JPEG · up to 2 MiB. Copy only visible receipt wording. Missing references are accepted; the investigator will review them.</p><button class="button secondary full" type="submit"${disabled("customer")}>Attach receipt</button><p id="receipt-draft-error" class="form-error" role="alert"></p></form></details></section>`;
}
function qrComparisonValue(key,value){
  if(value==null)return 'Missing / unavailable';
  if(['total','subtotal','tax','cash_paid','qr_posted_amount'].includes(key)&&typeof value==='number')return money(value);
  if(key==='item'&&Array.isArray(value))return value.map(row=>`${row[0]} · ${row[1]} × ${money(row[2])} = ${money(row[3])}`).join('; ');
  return String(value);
}
function qrOperatorPanel(c) {
  const pipe=c.qr_pipeline || {},scan=pipe.receipt_scan,market=pipe.marketplace,verdict=pipe.verdict,resolution=pipe.resolution;
  const receipt=[...c.evidence].reverse().find(e=>e.kind==="customer_supplied" && e.blob?.mime?.startsWith("image/"));
  const scanFresh=scan?.evidence_version===c.evidence_version && scan?.manifest_version===2;
  const marketFresh=market?.evidence_version===c.evidence_version && scanFresh && market?.status!=="STALE" && market?.review_id===pipe.receipt_review?.id;
  const verdictFresh=verdict?.evidence_version===c.evidence_version && marketFresh && verdict.status==='RECORDED' && verdict.source_result_id===market.id;
  const anim=S.qrAnimation;
  const isOwner=S.tokens.staff?.actor===c.owner;
  const completed=resolution?.state==="REFUND_COMPLETED";
  const stage=anim?.label || (completed?"Simulated refund completed · historical record":!scanFresh?"Scan the receipt":!marketFresh?"Review the receipt fields, then verify":!verdictFresh?"Record the source-grounded verdict":resolution?.state==="REFUND_COMPLETED"?"Simulated refund completed":resolution?.state==="REFUND_REQUESTED"?"Refund request approved · completion pending":verdict.outcome==="LEGITIMATE"?"Operator approval required":pipe.handoff?"Owned human review · automation paused":verdict.outcome==="UNCERTAIN"?"Create an owned human handoff":"Rejection explanation saved");
  let primary="";
  if(completed)primary="";
  else if(!scanFresh)primary=`<button class="button primary" data-check="receipt_scan" ${receipt && isOwner?"":"disabled"}${disabled("staff")}>Scan receipt ${icon("scan")}</button>`;
  else if(!marketFresh)primary=`<button class="button primary" data-check="marketplace" data-receipt-owner="${isOwner}" ${S.busy.staff?'data-busy="true"':''} ${isOwner&&QRReceipt.canVerify(c)?"":"disabled"}${disabled("staff")}>Verify with Marketplace ${icon("search")}</button>`;
  else if(!verdictFresh)primary=`<button class="button primary ${market.outcome.toLowerCase()}" data-qr-verdict="${esc(market.outcome)}" ${isOwner?"":"disabled"}${disabled("staff")}>Record ${market.outcome.toLowerCase()} verdict ${icon("check")}</button>`;
  else if(verdict.outcome==="LEGITIMATE" && resolution?.state!=="REFUND_COMPLETED")primary=`<button class="button primary" data-qr-action="${resolution?.state==="REFUND_REQUESTED"?"complete_refund":"approve_refund"}" ${isOwner?"":"disabled"}${disabled("staff")}>${resolution?.state==="REFUND_REQUESTED"?"Post simulated refund":"Approve simulated refund"} ${icon("cash")}</button>`;
  else if(verdict.outcome==="UNCERTAIN" && !pipe.handoff)primary=`<button class="button primary handoff" data-qr-action="handoff" ${isOwner?"":"disabled"}${disabled("staff")}>Create human handoff ${icon("users")}</button>`;
  const active=anim?.node;
  const graph=QRGraph.render(c.qr_events || [],{count:S.qrReplay??undefined,zoom:S.qrZoom,selected:S.qrSelected,active});
  const receiptView=QRReceipt.render(c,receipt,!isOwner||resolution?.state==='REFUND_COMPLETED');
  const marketView=market?`<section id="qr-marketplace" class="qr-market-section"><h3>Synthetic Marketplace response</h3><p>${esc(market.reason)}</p><div class="qr-table-scroll" tabindex="0" aria-label="Marketplace evidence comparison"><table><thead><tr><th>Field</th><th>Receipt / linked context</th><th>Marketplace record</th><th>Result</th></tr></thead><tbody>${market.comparisons.map(v=>`<tr><th>${esc(v.field.replaceAll('_',' '))}</th><td>${esc(qrComparisonValue(v.field,v.receipt))}</td><td>${esc(qrComparisonValue(v.field,v.marketplace))}</td><td class="${v.status.toLowerCase()}">${esc(v.status)}</td></tr>`).join('')}</tbody></table></div><p class="field-hint">${esc(market.source_id)} · exact purchase only · no external request</p></section>`:"";
  const handoff=pipe.handoff?`<section class="qr-resolution-card handoff"><h3>Human review is owned and open</h3><dl><dt>Current owner</dt><dd>${esc(actorName(c.owner))}</dd><dt>Receiving queue</dt><dd>${esc(pipe.handoff.queue)} · ${esc(actorName(pipe.handoff.destination))}</dd><dt>Next review</dt><dd>${date(c.next_review)}</dd><dt>Missing evidence</dt><dd>${esc(pipe.handoff.missing_evidence.join(', '))}</dd></dl><p>${esc(pipe.handoff.reason)}</p>${S.tokens.staff?.actor===pipe.handoff.destination && pipe.handoff.status==="REQUESTED"?'<button class="button primary" data-action="acknowledge">Accept human handoff</button>':""}</section>`:"";
  const outcome=verdictFresh||completed?`<section id="qr-outcome" class="qr-resolution-card ${verdict.outcome.toLowerCase()}"><h3>${verdict.outcome==="LEGITIMATE"?resolution.state==="REFUND_COMPLETED"?"Simulated refund completed":"Legitimate · refund proposed":verdict.outcome==="REJECTED"?"Rejected · no refund":"Uncertain · automation paused"}</h3><p>${esc(verdict.reason)}</p>${resolution?`<p><strong>${money(resolution.amount_minor)}</strong> · ${esc(resolution.state.replaceAll('_',' '))}. ${resolution.state==="REFUND_COMPLETED"?"Synthetic completion saved; no real money moved.":"Money returned is shown only after a completed-refund event."}</p>`:""}${handoff}</section>`:"";
  return `<section class="qr-operator-panel"><div class="qr-panel-head"><div><span class="eyebrow">AI FIRST-LINE OPERATOR</span><h3>Receipt → Marketplace → Outcome</h3><p>One receipt, one exact purchase, one saved outcome.</p></div><span class="qr-state-pill">Evidence v${c.evidence_version}</span></div><div class="qr-primary-stage"><div><span>CURRENT INVESTIGATION STEP</span><strong aria-live="polite">${esc(stage)}</strong>${!isOwner?`<small>${esc(actorName(c.owner))} owns the actions on this case.</small>`:!receipt?`<small>Request an original receipt from the customer using Case tools.</small>`:""}</div>${primary}</div>${!scanFresh&&scan?note(completed?"The completed refund remains historical. New evidence is preserved for follow-up and cannot create another refund.":"The evidence changed. Scan and verify the current receipt before taking another decision.","warning"):""}${marketFresh||anim?.kind==="marketplace"?`${graph}${marketView}${outcome}${receiptView}`:`${receiptView}<details class="qr-graph-preview"><summary>Preview the investigation workflow</summary>${graph}</details>`}<details class="qr-secondary-tools"><summary>Case tools and additional evidence</summary><div class="action-grid"><button class="button secondary" data-modal="task">Request evidence</button><button class="button secondary" data-modal="evidence">Add operator notes</button><button class="button secondary" data-action="export">Export dossier</button></div>${requestList(c)}</details></section>`;
}
function staffOverview(c) {
  const f = c.facts,
    a = c.analysis_fresh ? c.analysis?.assessment : null,
    pending = c.handoffs.find((h) => h.status === "REQUESTED");
  if(c.workflow==="qr_cash")return qrOperatorPanel(c);
  return `<div class="case-context"><div><span class="eyebrow">CUSTOMER’S REPORT</span><p>${esc(c.description)}</p><div class="context-tags"><span class="mono">${esc(c.purchase_id)}</span><span>Second payment claimed: <b>${money(c.reported_amount_minor)} cash</b></span></div></div></div><div class="section-heading"><h3>${icon("search")}Check the source records</h3><span>Read-only · This purchase only</span></div><div class="source-grid">${[
    ["qr", "QR provider", "scan"],
    ["invoice", "Purchase invoice", "receipt"],
    ["merchant", "Merchant cash record", "cash"],
    ["repayment", "Repayment record", "refresh"],
  ]
    .map(([kind, title, ic]) => {
      const ch = [...c.checks].reverse().find((ch) => ch.kind === kind);
      return `<button class="source-check" data-check="${kind}"${disabled("staff")}><span class="source-icon">${icon(ic)}</span><strong>${title}</strong><small>${ch?.state === "COMPLETED" ? "Checked · View or refresh" : ch?.state === "UNAVAILABLE" ? "No record available" : "Check this source"}</small><span class="source-indicator ${ch?.state === "COMPLETED" ? "green" : ch?.state === "UNAVAILABLE" ? "amber" : ""}">${icon(ch?.state === "COMPLETED" ? "check" : "arrow")}</span></button>`;
    })
    .join(
      "",
    )}</div><div class="assessment-toolbar"><div><h3>${icon("spark")}Evidence assessment</h3><span>${c.analysis_fresh ? "Uses the current evidence version" : c.analysis ? "New evidence · previous analysis is stale" : "Check the evidence, then assess the report"}</span></div><button class="button dark small" data-action="analyze"${disabled("staff")}>${S.busy.staff || (c.analysis ? "Update assessment" : "Run assessment")} ${icon("spark")}</button></div>${assessmentCard(a, false, !!c.analysis && !c.analysis_fresh)}<div class="amount-strip">${[
    ["Invoice total", f.purchase_total_minor],
    ["Recorded paid", f.recorded_paid_minor],
    ["Recorded excess", f.recorded_excess_minor],
    ["Recorded returned", f.recorded_repaid_minor],
  ]
    .map(
      ([t, n]) => `<div><small>${t}</small><strong>${money(n)}</strong></div>`,
    )
    .join(
      "",
    )}</div><p class="field-hint">Only checked, matching mock records contribute to these amounts. A reported cash amount is not automatically counted.</p><div class="section-heading"><h3>Move the case forward</h3><span>Every action is saved</span></div><div class="action-grid"><button class="button secondary" data-modal="task"${disabled("staff")}>${icon("chat")}Request evidence</button><button class="button secondary" data-modal="decision"${disabled("staff")}>${icon("check")}Save review</button>${c.simulation_id ? `<button class="button secondary" data-modal="repayment-request" ${!c.analysis_fresh || a?.status !== "SUPPORTED" || c.evidence.some((e) => e.kind === "repayment_request") ? "disabled" : ""}${disabled("staff")}>${icon("receipt")}Request resolution</button>` : ""}<button class="button secondary" data-modal="handoff" ${pending ? "disabled" : ""}${disabled("staff")}>${icon("users")}Hand off</button><button class="button secondary" data-action="export"${disabled("staff")}>${icon("download")}Export dossier</button>${!c.qr_reference ? '<button class="button secondary" data-modal="link">Link a payment</button>' : ""}</div>${!c.analysis_fresh ? '<p class="field-hint">A current assessment is required before saving a review or resolution request.</p>' : ""}${pending ? `<div class="handoff-note"><p>Handoff requested to ${actorName(pending.destination)}. ${actorName(c.owner)} keeps ownership until it is accepted.</p>${S.tokens.staff?.actor === pending.destination ? `<button class="button primary small" data-action="acknowledge"${disabled("staff")}>Accept handoff</button>` : ""}</div>` : ""}${requestList(c)}${c.analysis ? modelDetails(c) : ""}`;
}
function requestList(c) {
  return c.tasks.length
    ? `<section class="request-list"><h3>Saved follow-up requests</h3>${c.tasks.map((t) => `<article><div><span>${pill(t.status, t.status === "RESOLVED" ? "green" : t.status === "RESPONDED" ? "violet" : "amber")}<small>${esc(t.audience || "customer")} · ${date(t.next_review)}</small></span><p>${esc(t.question)}</p>${t.status === "RESPONDED" ? "<small>Customer replied. Review the linked evidence before resolving this request.</small>" : ""}</div>${["OPEN", "RESPONDED"].includes(t.status) ? `<button class="button quiet small" data-resolve="${esc(t.id)}"${disabled("staff")}>Review response ${icon("arrow")}</button>` : ""}</article>`).join("")}</section>`
    : "";
}
const textLabel = (l) =>
  ({
    SUPPORTED_BY_PASSAGE: "Text supports",
    CONTRADICTED_BY_PASSAGE: "Text contradicts",
    INSUFFICIENT_EVIDENCE: "Insufficient text",
  })[l] || l;
function modelDetails(c) {
  return `<details class="model-details"><summary>${icon("spark")} Inspect text-model readings &amp; provenance <span>${c.analysis_fresh ? "Current" : "Stale snapshot"}</span></summary><p class="field-hint">The trained model reads wording. Source authority and the case assessment are separate. Current engine: ${esc(c.analysis.model.engine)}. Training is synthetic; no independent real-case accuracy is claimed.</p>${c.analysis.claims.map((cl) => `<div class="claim-group"><div><strong>${esc(cl.text)}</strong><button class="button quiet small" data-claim="${esc(cl.id)}">Edit claim</button></div>${cl.links.map((l) => `<button class="claim-reading" data-evidence="${esc(l.evidence_id)}"><span>${pill(textLabel(l.label), l.label === "CONTRADICTED_BY_PASSAGE" ? "amber" : "neutral")}<small>${esc(l.source_status)}</small></span><p>${esc(l.excerpt)}</p><small>Trained advisory: ${esc(textLabel(l.learned_label || l.raw_model_label))} · Transcript v${l.transcript_version}${l.mismatches.length ? " · " + esc(l.mismatches.join(" ")) : ""}</small></button>`).join("")}</div>`).join("")}</details>`;
}
function evidenceScreen(c) {
  const selected =
    c.evidence.find((e) => e.id === S.selectedEvidence) || c.evidence[0];
  if (!selected)
    return '<div class="desk-empty">No evidence has been saved yet.</div>';
  return `<div class="section-heading"><h3>Preserved evidence</h3><button class="button secondary small" data-modal="evidence"${disabled("staff")}>${icon("plus")}Add supplied evidence</button></div><div class="evidence-layout"><div class="evidence-list"><p class="eyebrow">${c.evidence.length} SAVED RECORDS</p>${c.evidence.map((e, i) => `<button class="evidence-item ${selected.id === e.id ? "selected" : ""}" data-evidence="${esc(e.id)}"><span class="record-number">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(e.kind.replaceAll("_", " "))}</strong><small>${esc(e.reference || "Customer wording")}</small>${pill(e.kind.startsWith("mock_") ? "Mock source" : "Supplied · unverified", e.kind.startsWith("mock_") ? "green" : "amber")}</div></button>`).join("")}</div><article class="evidence-viewer"><p class="eyebrow">SOURCE RECORD · PRESERVED ORIGINAL</p><h3>${esc(selected.reference || "Supplied evidence")}</h3>${pill(selected.authority, selected.kind.startsWith("mock_") ? "green" : "amber")}${selected.blob?.mime?.startsWith("image/") ? `<figure class="evidence-image"><img src="data:${esc(selected.blob.mime)};base64,${selected.blob.base64}" alt="Original supplied receipt image"><figcaption>Original supplied image · authenticity is unverified</figcaption></figure>` : ""}<blockquote>${esc(selected.revisions.at(-1).text)}</blockquote><dl class="evidence-metadata"><div><dt>Purchase</dt><dd class="mono">${esc(selected.purchase_id || "Not linked")}</dd></div><div><dt>Received</dt><dd>${date(selected.received_at)}</dd></div><div><dt>Verification</dt><dd>${esc(selected.verification)}</dd></div><div><dt>Revision</dt><dd>v${selected.revisions.at(-1).version} · ${selected.revisions.length} preserved version(s)</dd></div><div><dt>Original SHA-256</dt><dd class="hash">${esc(selected.original_hash)}</dd></div></dl><div class="viewer-actions"><button class="button secondary small" data-original="${esc(selected.id)}">${icon("download")}Get original</button>${!selected.kind.startsWith("mock_") ? `<button class="button secondary small" data-correct="${esc(selected.id)}">Correct transcript</button>` : ""}</div><details class="revision-history"><summary>Original wording &amp; revision history</summary>${selected.revisions.map((r) => `<div><strong>v${r.version} · ${date(r.at)}</strong><p>${esc(r.text)}</p><small>${esc(r.reason)}</small></div>`).join("")}</details></article></div>`;
}
function staffActivity(c) {
  const audit = c.audit || [];
  return `<div class="section-heading"><h3>Case activity</h3><span>Saved server events</span></div><ol class="desk-timeline">${audit
    .slice()
    .reverse()
    .map(
      (a) =>
        `<li><span class="timeline-dot"></span><time>${date(a.at)}</time><strong>${esc(a.action.replaceAll("_", " "))}</strong><p>${esc(actorName(a.actor))} · Case v${a.version}</p></li>`,
    )
    .join(
      "",
    )}</ol><section class="check-history"><h3>Source-check history</h3>${
    c.checks
      .slice()
      .reverse()
      .map(
        (ch) =>
          `<details><summary>${esc(ch.kind)} · ${esc(ch.state)} · ${date(ch.requested_at)}</summary><p>${esc(ch.result)}</p><div class="check-states">${ch.states.map((s) => pill(s.state, s.state === "COMPLETED" ? "green" : "neutral")).join("")}</div></details>`,
      )
      .join("") || '<p class="muted">No source check has run yet.</p>'
  }</section>`;
}
function renderLab() {
  if(!S.staffCase || S.staffCase.workflow==="qr_cash"){
    $("#lab-body").innerHTML=`<div class="lab-grid"><div><h3>Saved journeys</h3><label class="field"><span>Resume a saved purchase</span><select id="saved-simulation"><option value="">Choose a purchase…</option>${S.sims.map(s=>`<option value="${s.id}" ${s.id===S.sim?.id?"selected":""}>${esc(s.merchant)} · ${esc(s.purchase_id)}</option>`).join('')}</select></label><button class="button secondary" data-action="new-purchase">Start new scenario</button></div><div><h3>Demonstration contract</h3><p class="field-hint">Marketplace and bank records are bounded synthetic fixtures. Receipt annotations are visual assistance. Refund completion is simulated and requires operator approval.</p><a class="companion-link" href="${journeyURL("desk")}" target="_blank" rel="noopener">Open companion view ↗</a></div></div>`;return;
  }
  const sim = S.sim,
    c = S.staffCase;
  $("#lab-body").innerHTML =
    `<div class="lab-grid"><div><label class="field" for="simulation-profile"><span>Source setup for the next purchase</span><select id="simulation-profile" aria-label="Source setup for the next purchase" ${sim || S.busy.customer ? "disabled" : ""}>${sim ? '<option value="" selected>Locked for the current purchase</option>' : ""}${[
      ["confirmed", "Merchant independently confirms cash"],
      ["unverified", "Only the customer’s cash assertion"],
      ["denied", "Merchant denies receiving cash"],
      ["qr_failed", "QR fails; merchant records cash"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${!sim && v === S.profile ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><p class="field-hint">Choose before creating a purchase. The AI sees only evidence imported into the case. For split tender, set the invoice total above the two payment amounts.</p><button class="button secondary small" data-action="new-purchase">${icon("plus")}New simulation</button></div><div><label class="field" for="saved-simulation"><span>Resume a saved purchase</span><select id="saved-simulation" aria-label="Resume a saved purchase"><option value="">Choose a purchase…</option>${S.sims.map((s) => `<option value="${esc(s.id)}" ${s.id === sim?.id ? "selected" : ""}>${esc(s.merchant)} · ${money(s.total_minor)} · ${s.purchase_id}</option>`).join("")}</select></label><p class="field-hint">Prior purchases and complaints are preserved. Reloading continues the selected purchase.</p><button class="button quiet small" data-filter="all">Open seeded example cases ${icon("arrow")}</button><button class="button quiet small" data-action="evaluation">Model evaluation ${icon("spark")}</button><button class="button quiet small" data-action="advance-seeded">Advance seeded repayment example ${icon("arrow")}</button></div><div><p class="eyebrow">LAST STAGE · FICTIONAL SOURCE</p><h3>Simulate a completed repayment record</h3><p class="field-hint">After the investigator records a supported resolution request, make a mock repayment record available. It appears in the case only after a repayment check.</p><button class="button secondary small" data-modal="simulate-repayment" ${!c?.simulation_id || !c.evidence.some((e) => e.kind === "repayment_request") ? "disabled" : ""}${disabled("staff")}>Advance repayment source ${icon("arrow")}</button></div></div>`;
}
function render() {
  renderJourney();
  renderPhone();
  renderDesk();
  renderLab();
  updateJourneyLinks();
}
async function selectCustomerCase(id) {
  S.customerCase = await api("customer", "/cases/" + encodeURIComponent(id));
  if (S.customerCase.simulation_id) {
    S.sim = await api(
      "customer",
      "/simulations/" + S.customerCase.simulation_id,
    );
  } else S.sim = null;
  rememberSelection();
  S.phone = "case";
  S.customerTab = "summary";
  S.selectedTask = null;
  await selectStaffCase(id);
  render();
}
async function selectStaffCase(id) {
  S.staffCase = await api("staff", "/cases/" + encodeURIComponent(id));
  S.staffTab = "overview";
  S.selectedEvidence = null;
  renderDesk();renderJourney();
  renderLab();updateJourneyLinks();
}
async function sync(force = false) {
  if (S.polling) {
    if (force) {
      await S.syncTask;
      return sync(true);
    }
    return;
  }
  S.polling = true;
  let release;
  S.syncTask = new Promise((resolve) => (release = resolve));
  try {
    const [sims, customerCases, cases, incoming] = await Promise.all([
      api("customer", "/simulations"),
      api("customer", "/cases"),
      api("staff", "/cases"),
      api("staff", "/simulation-inbox"),
    ]);
    S.sims = sims;
    S.customerCases = customerCases.filter(c => !c.transaction_id);
    S.cases = cases.filter(c => !c.transaction_id);
    S.incoming = incoming;
    const nextSim = S.sim ? sims.find((s) => s.id === S.sim.id) : null;
    let phoneChanged = false,
      deskChanged = false;
    if (nextSim && (force || nextSim.version !== S.sim.version)) {
      S.sim = nextSim;
      phoneChanged = true;
    }
    if (S.customerCase) {
      const next = customerCases.find((c) => c.id === S.customerCase.id);
      if (next && (force || next.version !== S.customerCase.version)) {
        S.customerCase = next;
        phoneChanged = true;
      }
    }
    if (S.staffCase) {
      const next = cases.find((c) => c.id === S.staffCase.id);
      if (next && (force || next.version !== S.staffCase.version)) {
        S.staffCase = await api("staff", "/cases/" + next.id);
        deskChanged = true;
      }
    }
    if (force || phoneChanged) {
      renderPhone();
      renderJourney();
    }
    if (force || deskChanged || !S.staffCase) {renderDesk();renderJourney();}
    if (force || phoneChanged || deskChanged) renderLab();
    $("#sync-state").textContent = "Synced " + clock();
    $("#sync-state").classList.remove("offline");
  } catch (e) {
    $("#sync-state").textContent = "Connection paused · use Refresh";
    $("#sync-state").classList.add("offline");
    if (force) throw e;
  } finally {
    S.polling = false;
    release();
  }
}
async function busy(role, label, fn) {
  if (S.busy[role]) return;
  S.busy[role] = label;
  render();
  try {
    return await fn();
  } catch (e) {
    if (e.status === 409) await sync(true).catch(() => {});
    throw e;
  } finally {
    delete S.busy[role];
    render();
  }
}
$("#action-dialog").addEventListener("close",()=>{
  const trigger=S.dialogTrigger?.isConnected?S.dialogTrigger:S.dialogTriggerSelector?document.querySelector(S.dialogTriggerSelector):null;
  trigger?.focus({preventScroll:true});
});
const reducedMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealPause=()=>new Promise(resolve=>setTimeout(resolve,reducedMotion()?0:450));
async function runQRCheck(kind){
  const payload=kind==='marketplace'?QRReceipt.reviewPayload(S.staffCase):null;
  await busy("staff",kind==="receipt_scan"?"Processing receipt image…":"Querying Marketplace…",async()=>{
    const c=S.staffCase;
    S.qrAnimation={kind,node:kind==="receipt_scan"?"receipt_scan":"purchase_lookup",label:kind==="receipt_scan"?"Processing receipt image":"AI sends an exact purchase query",index:0};
    renderDesk();
    try{
      if(payload)await caseAction('qr-action',payload);
      await caseAction("check",{kind,evidence_version:S.staffCase.evidence_version});
      if(kind==='receipt_scan')await QRReceipt.animate(S.staffCase);
      else{
        const labels=["AI sends query to Marketplace database","Marketplace returns the order record","Comparing amount and item","Checking QR transaction reference","Corroborating the bank debit","Comparing the cash receipt claim"];
        const nodes=["purchase_lookup","order_match","amount_match","qr_lookup","bank_debit","cash_claim"];
        for(let i=0;i<labels.length;i++){
          if(S.staffCase?.id!==c.id)break;
          S.qrAnimation={kind,node:nodes[i],label:labels[i],index:i};renderDesk();
          if(!reducedMotion()&&i===0)document.querySelector('.graph--qr')?.scrollIntoView({block:'start',behavior:'instant'});
          await revealPause();
        }
      }
    }finally{S.qrAnimation=null;render();}
  });
}
async function replayQR(){
  const caseId=S.staffCase?.id,events=S.staffCase?.qr_events||[],token=S.qrReplayToken=(S.qrReplayToken||0)+1;
  if(S.qrReplay!==null)S.qrReplay=null;
  for(let i=0;i<=events.length;i++){
    if(S.staffCase?.id!==caseId || token!==S.qrReplayToken)break;
    S.qrReplay=i;renderDesk();await revealPause();
    if(S.qrReplay===null)break;
  }
}
let qrPan=null;
document.addEventListener("pointerdown",event=>{
  const viewport=event.target.closest(".qr-board-viewport");
  if(!viewport||event.target.closest("[data-qr-node]")||event.pointerType!=="mouse")return;
  qrPan={viewport,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
  viewport.setPointerCapture(event.pointerId);event.preventDefault();
});
document.addEventListener("pointermove",event=>{
  if(!qrPan)return;
  qrPan.viewport.scrollLeft=qrPan.left+qrPan.x-event.clientX;
  qrPan.viewport.scrollTop=qrPan.top+qrPan.y-event.clientY;
});
document.addEventListener("pointerup",()=>qrPan=null);
document.addEventListener("keydown",event=>{
  if((event.key==="Enter"||event.key===" ") && event.target.matches("[data-qr-node]")){
    event.preventDefault();S.qrSelected=event.target.dataset.qrNode;renderDesk();document.querySelector(`[data-qr-node="${S.qrSelected}"]`)?.focus({preventScroll:true});
  }
});
async function caseAction(action,body={}) {
  const c=S.staffCase;if(!c)throw Error("Open a case first.");
  const result=await mutate("staff","/cases/"+c.id+"/"+action,{version:c.version,...(c.workflow==="qr_cash"?{evidence_version:c.evidence_version}:{}),...body});
  if(S.staffCase?.id===c.id)S.staffCase=result;
  await sync(true);return result;
}
async function simAction(action,body={}) {
  const sim=S.sim;
  const result=await mutate("customer","/simulations/"+sim.id+"/action",{version:sim.version,action,...body});
  if(S.sim?.id===sim.id){S.sim=result;rememberSelection();S.phone="flow";}
  await sync(true);
}
async function analyze() {
  await busy("staff", "Reading current evidence…", async () => {
    await caseAction("analyze");
    toast("Assessment saved with the current evidence and source citations.");
  });
}
function newPurchase() {
  if (S.busy.customer || S.busy.staff) {
    toast("Wait for the current saved action to finish.");
    return;
  }
  S.sim = null;
  S.customerCase = null;
  S.staffCase = null;
  S.phone = "purchase";
  S.qrAmountEdited=false;sessionStorage.setItem("tf.qrAmountEdited","false");delete S.drafts.purchase?.qr_amount_minor;
  S.selectedTask = null;
  S.file = null;
  if (S.view === "desk") setView("phone");
  rememberSelection();
  render();
  $("#phone-content").scrollTop = 0;
  $("#purchase-customer_name")?.focus({ preventScroll: true });
}
function openDialog(
  title,
  html,
  action,
  label = "Save",
  kicker = "CASE ACTION",
) {
  S.modal = { action };
  $("#dialog-title").textContent = title;
  $("#dialog-kicker").textContent = kicker;
  $("#dialog-body").innerHTML = html;
  $("#dialog-error").textContent = "";
  $("#dialog-submit").textContent = label;
  $("#dialog-submit").hidden = !action;
  S.dialogTrigger=document.activeElement;S.dialogTriggerSelector=focusSelector(document.activeElement);
  $("#action-dialog").showModal();
}
function evidenceChoices(c, selected = []) {
  return `<fieldset class="citation-select"><legend>Cite the evidence used for your review</legend>${c.evidence.map((e) => `<label><input type="checkbox" name="evidence_ids" value="${esc(e.id)}" ${selected.includes(e.id) ? "checked" : ""}><span><strong>${esc(e.reference || e.kind.replaceAll("_", " "))}</strong><small>${esc(e.revisions.at(-1).text)}</small></span></label>`).join("")}</fieldset>`;
}
function actionDialog(kind, id) {
  const c = S.staffCase;
  if (!c && kind !== "help") return;
  const form = "dialog";
  if (kind === "task")
    openDialog(
      "Request the missing evidence",
      `${textarea(form, "question", "What do you need from the customer?", "", 'required maxlength="1000" rows="4" placeholder="Ask a concrete question about this purchase…"')}<div class="field-row"><label class="field" for="dialog-audience"><span>Request directed to</span><select id="dialog-audience" aria-label="Request directed to" name="audience"><option value="customer">Customer · appears in their app</option><option value="merchant">Merchant · internal follow-up</option><option value="internal">Investigation team</option></select></label>${field(form, "next_review", "Next review (Dhaka)", future(), "datetime-local", "required")}</div>`,
      (f) =>
        caseAction("task", {
          question: f.get("question"),
          audience: f.get("audience"),
          next_review: f.get("next_review") + "+06:00",
        }),
      "Send request",
    );
  if (kind === "decision")
    openDialog(
      "Save a cited investigator review",
      `<label class="field" for="dialog-decision"><span>Review outcome</span><select id="dialog-decision" aria-label="Review outcome" name="decision"><option value="EVIDENCE_ASSEMBLED">Evidence assembled for resolution review</option><option value="FURTHER_EVIDENCE">Further evidence needed</option><option value="REFERRAL">Refer for further investigation</option><option value="OUTCOME_RECORDED" ${c.facts.recorded_repaid_minor ? "" : "disabled"}>Record the checked repayment outcome</option></select></label>${textarea(form, "note", "Message shared with the customer", "", 'required maxlength="2000" rows="4"')}${evidenceChoices(c, c.analysis_fresh ? c.analysis?.assessment?.evidence_ids || [] : [])}${note("A current assessment and at least one evidence citation are required. Saving a review executes no payment.")}`,
      (f) =>
        caseAction("decision", {
          decision: f.get("decision"),
          note: f.get("note"),
          evidence_ids: f.getAll("evidence_ids"),
        }),
      "Save & share review",
    );
  if (kind === "repayment-request")
    openDialog(
      "Record a resolution request",
      `${note("Visible records support an excess of " + money(c.facts.recorded_excess_minor) + ". This records a request for review; repayment remains uncompleted until a source record is checked.")}${textarea(form, "note", "Message to the customer", "The matching invoice, QR posting and merchant cash record support an overpayment. I have requested resolution review and will check for a completed repayment record.", 'required maxlength="1000" rows="5"')}`,
      (f) => caseAction("repayment-request", { note: f.get("note") }),
      "Record request",
    );
  if (kind === "handoff")
    openDialog(
      "Hand off with clear ownership",
      `<label class="field" for="dialog-destination"><span>Receiving investigator</span><select id="dialog-destination" aria-label="Receiving investigator" name="destination"><option value="${c.owner === "staff_1" ? "staff_2" : "staff_1"}">${actorName(c.owner === "staff_1" ? "staff_2" : "staff_1")}</option></select></label>${textarea(form, "reason", "Reason and next step", "", 'required maxlength="1000" rows="4"')}${note("The current owner remains responsible until the receiving investigator accepts the handoff.")}`,
      (f) =>
        caseAction("handoff", {
          destination: f.get("destination"),
          reason: f.get("reason"),
        }),
      "Request handoff",
    );
  if (kind === "resolve") {
    const t = c.tasks.find((t) => t.id === id);
    openDialog(
      "Review the evidence response",
      `<p>${esc(t.question)}</p><label class="field" for="dialog-evidence_id"><span>Evidence addressing this request</span><select id="dialog-evidence_id" aria-label="Evidence addressing this request" name="evidence_id">${c.evidence.map((e) => `<option value="${e.id}" ${e.id === t.response_evidence_id ? "selected" : ""}>${esc((e.reference || e.kind) + " · " + e.revisions.at(-1).text.slice(0, 90))}</option>`).join("")}</select></label>${textarea(form, "reason", "What did the response establish?", "", 'required maxlength="1000" rows="4"')}`,
      (f) =>
        caseAction("resolve-task", {
          task_id: id,
          evidence_id: f.get("evidence_id"),
          reason: f.get("reason"),
        }),
      "Save response review",
    );
  }
  if (kind === "correct") {
    const e = c.evidence.find((e) => e.id === id);
    openDialog(
      "Correct a supplied transcript",
      `${textarea(form, "text", "Corrected wording", e.revisions.at(-1).text, 'required maxlength="4000" rows="5"')}${field(form, "reference", "Reference (optional)", e.reference || "", "text", 'maxlength="100"')}${textarea(form, "reason", "Reason for this correction", "", 'required maxlength="1000" rows="3"')}${note("The original file and every previous revision remain preserved. Existing analysis and decisions become stale.")}`,
      (f) =>
        caseAction("correct", {
          evidence_id: id,
          text: f.get("text"),
          reference: f.get("reference"),
          reason: f.get("reason"),
        }),
      "Save revision",
    );
  }
  if (kind === "claim") {
    const cl = c.analysis.claims.find((cl) => cl.id === id);
    openDialog(
      "Revise the claim wording",
      `${textarea(form, "text", "Claim to assess", cl.text, 'required maxlength="500" rows="3"')}${textarea(form, "reason", "Reason for correction", "", 'required maxlength="1000" rows="3"')}`,
      (f) =>
        caseAction("claim", {
          claim_id: id,
          text: f.get("text"),
          reason: f.get("reason"),
        }),
      "Save claim",
    );
  }
  if (kind === "link")
    openDialog(
      "Link an exact owned payment",
      `${field(form, "reference", "Exact QR reference", "", "text", 'required maxlength="100"')}${textarea(form, "reason", "Why does this reference belong to this case?", "", 'required maxlength="1000" rows="3"')}`,
      (f) =>
        caseAction("link", {
          reference: f.get("reference"),
          reason: f.get("reason"),
        }),
      "Link reference",
    );
  if (kind === "evidence")
    openDialog(
      "Add a supplied evidence record",
      `<label class="field" for="dialog-kind"><span>Who supplied the wording?</span><select id="dialog-kind" aria-label="Who supplied the wording?" name="kind"><option value="staff_supplied">Investigation notes</option><option value="merchant_supplied">Merchant-supplied statement</option><option value="customer_supplied">Customer-supplied statement</option></select></label>${textarea(form, "text", "Evidence wording", "", 'required maxlength="4000" rows="5"')}${field(form, "reference", "Document reference (optional)", "", "text", 'maxlength="100"')}${field(form, "purchase_id", "Purchase reference", c.purchase_id, "text", 'required maxlength="100"')}${field(form, "amount_minor", "Amount described (৳, optional)", "", "text", 'inputmode="decimal"')}<label class="field" for="dialog-assertion"><span>Merchant response type</span><select id="dialog-assertion" aria-label="Merchant response type" name="assertion"><option value="unspecified">No explicit denial</option><option value="denial">Merchant denies receiving cash</option></select></label>${note("Supplied wording remains unverified. An investigator upload cannot grant provider or merchant source authority.")}`,
      (f) =>
        caseAction("evidence", {
          kind: f.get("kind"),
          text: f.get("text"),
          reference: f.get("reference"),
          purchase_id: f.get("purchase_id"),
          assertion: f.get("assertion"),
          ...(String(f.get("amount_minor")).trim()
            ? { amount_minor: minor(f.get("amount_minor")) }
            : {}),
        }),
      "Add record",
    );
  if (kind === "simulate-repayment")
    openDialog(
      "Advance the fictional repayment source",
      `${note("This is a simulation control. It creates a fictional completed-repayment record for the saved resolution request. No real money is moved.")}<p>The case itself will not change until an investigator runs the repayment check.</p>`,
      async () => {
        const sim = await api("staff", "/simulations/" + c.simulation_id);
        const result = await mutate(
          "staff",
          "/simulations/" + sim.id + "/repayment",
          { version: sim.version },
        );
        return result;
      },
      "Make mock record available",
      "SIMULATION CONTROL",
    );
}
async function download(path, name) {
  const r = await fetch("/api" + path, {
    headers: { "X-TraceFix-Session": S.tokens.staff.token },
  });
  if (!r.ok) {
    let data = await r.json();
    throw Error(data.detail || "Download failed.");
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function uploadEvidence(file, transcript) {
  const signature = [
    S.customerCase.id,
    file.name,
    file.size,
    file.lastModified,
    file.type,
    transcript,
  ].join("|");
  const previous = read("tf.uploadPending", null);
  const pending =
    previous?.signature === signature
      ? previous
      : { signature, id: crypto.randomUUID(), version: S.customerCase.version };
  sessionStorage.setItem("tf.uploadPending", JSON.stringify(pending));
  const data = new FormData();
  data.set("file", file);
  data.set("version", pending.version);
  data.set("transcript", transcript);
  try {
    const result = await api(
      "customer",
      "/cases/" + S.customerCase.id + "/upload",
      {
        method: "POST",
        body: data,
        headers: { "Idempotency-Key": pending.id },
      },
    );
    sessionStorage.removeItem("tf.uploadPending");
    return result;
  } catch (e) {
    if (e.status && e.status < 500)
      sessionStorage.removeItem("tf.uploadPending");
    throw e;
  }
}
async function showEvaluation() {
  const result = await api("staff", "/evaluation");
  if (result.status !== "completed") {
    openDialog(
      "Model evaluation",
      `<p>${esc(result.status || "Evaluation not yet run")}</p>`,
      null,
    );
    return;
  }
  const rows = Object.entries(result.suites).flatMap(([suite, engines]) =>
    Object.entries(engines)
      .filter(([, v]) => v && typeof v.macro_f1 === "number")
      .map(
        ([engine, v]) =>
          `<tr><td>${esc(suite.replaceAll("_", " "))}</td><td>${esc(engine.replaceAll("_", " "))}</td><td>${v.pairs}</td><td>${v.macro_f1.toFixed(3)}</td></tr>`,
      ),
  );
  openDialog(
    "Actual synthetic model evaluation",
    `<p>${esc(result.model.architecture)}. Training pairs: ${result.model.training_pairs}. These scores measure text-pair labels, not complaint eligibility.</p><div class="evaluation-table"><table><thead><tr><th>Suite</th><th>Engine</th><th>Pairs</th><th>Macro F1</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>${note("The trained model is advisory because its broader wording performance is weak. No independent human or real-case validation has been completed. Source matching and amount checks remain explicit rules.")}`,
    null,
    "",
    "MEASURED ARTIFACTS",
  );
}
document.addEventListener("input", (e) => {
  if(e.target.dataset.basket){S.basket[Number(e.target.dataset.index)][e.target.dataset.basket]=e.target.value;sessionStorage.setItem('tf.basket',JSON.stringify(S.basket));}
  if(e.target.id==='purchase-qr_amount_minor'){S.qrAmountEdited=true;sessionStorage.setItem('tf.qrAmountEdited','true');}
  const form = e.target.closest("form[data-draft]");
  if (form && e.target.name && e.target.type !== "file") {
    S.drafts[form.dataset.draft] ??= {};
    S.drafts[form.dataset.draft][e.target.name] = e.target.value;
    sessionStorage.setItem("tf.drafts", JSON.stringify(S.drafts));
  }
  if(form?.id==='purchase-form'){
    try{const total=basketTotal();$('#basket-total').textContent=money(total);$('#basket-subtotal').textContent=money(total-minor(S.drafts.purchase?.tax_minor||'0',true));document.querySelectorAll('[data-basket-line]').forEach(el=>{const row=S.basket[Number(el.dataset.basketLine)];el.textContent=money(minor(row.price)*Number(row.quantity));});
      const input=$('#purchase-qr_amount_minor');if(!S.qrAmountEdited){input.value=amount(total);S.drafts.purchase??={};S.drafts.purchase.qr_amount_minor=input.value;sessionStorage.setItem('tf.drafts',JSON.stringify(S.drafts));}
      $('#purchase-error').textContent=minor(input.value)>total?'QR amount cannot exceed the invoice total.':'';
    }catch{$('#basket-total').textContent='Check item amounts';}
  }
});
document.addEventListener("change", async (e) => {
  try {
    if (e.target.id === "upload-file") {
      S.file = e.target.files[0] || null;
    }
    if (e.target.id === "simulation-profile" || e.target.id === "purchase-profile") S.profile = e.target.value;
    if (e.target.id === "staff-identity") {
      S.staffRole = e.target.value;
      await ensureSession("staff", true);
      renderDesk();
      toast("Switched to " + actorName(S.tokens.staff.actor) + ".");
    }
    if (e.target.id === "saved-simulation" && e.target.value) {
      S.sim = await api("customer", "/simulations/" + e.target.value);
      S.customerCase = S.sim.case_id
        ? await api("customer", "/cases/" + S.sim.case_id)
        : null;
      S.phone = S.customerCase ? "case" : "flow";
      if (S.customerCase) await selectStaffCase(S.customerCase.id);
      else S.staffCase=null;
      rememberSelection();render();
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button, a, [data-qr-node]");
  if (!b || b.disabled) return;
  try {
    if (b.dataset.view) {
      if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;
      e.preventDefault();
      setView(b.dataset.view,true);
      $(b.dataset.view==="phone"?"#phone-content":"#desk").scrollIntoView({block:"start"});
      return;
    }
    if (b.dataset.phoneNav) {
      S.phone =
        b.dataset.phoneNav === "home"
          ? S.sim
            ? "flow"
            : "purchase"
          : b.dataset.phoneNav === "support"
            ? S.customerCase
              ? "case"
              : "cases"
            : "activity";
      renderPhone();
      $("#phone-content").scrollTop = 0;
      return;
    }
    if (b.dataset.customerTab) {
      S.customerTab = b.dataset.customerTab;
      renderPhone();
      return;
    }
    if (b.dataset.staffTab) {
      S.staffTab = b.dataset.staffTab;
      renderDesk();
      return;
    }
    if (b.dataset.filter) {
      if (S.busy.staff) return;
      S.filter = b.dataset.filter;
      S.staffCase = null;
      renderDesk();
      return;
    }
    if(b.dataset.resumeSim){
      S.sim=await api("customer","/simulations/"+b.dataset.resumeSim);
      S.customerCase=S.sim.case_id?await api("customer","/cases/"+S.sim.case_id):null;
      S.staffCase=null;if(S.customerCase)await selectStaffCase(S.customerCase.id);
      S.phone=S.customerCase?"case":"flow";rememberSelection();render();return;
    }
    if (b.dataset.customerCase) {
      if (S.busy.customer || S.busy.staff) return;
      await selectCustomerCase(b.dataset.customerCase);
      return;
    }
    if (b.dataset.staffCase) {
      if (S.busy.staff) return;
      if(S.customerCases.some(c=>c.id===b.dataset.staffCase))await selectCustomerCase(b.dataset.staffCase);
      else {S.customerCase=null;S.sim=null;await selectStaffCase(b.dataset.staffCase);}
      setView("desk",true);return;
    }
    if (b.dataset.replyTask) {
      S.selectedTask = b.dataset.replyTask;
      S.customerTab = "chat";
      renderPhone();
      $("#customer-message-" + S.customerCase.id + "-text")?.focus();
      return;
    }
    if (b.dataset.evidence) {
      S.selectedEvidence = b.dataset.evidence;
      S.staffTab = "evidence";
      renderDesk();
      return;
    }
    if(b.dataset.qrNode){S.qrSelected=b.dataset.qrNode;renderDesk();document.querySelector(`[data-qr-node="${S.qrSelected}"]`)?.focus({preventScroll:true});return;}
    if(b.dataset.qrZoom){S.qrZoom=b.dataset.qrZoom==="fit"?Math.max(.42,Math.min(1,($("#desk").clientWidth-64)/1200)):Math.max(.42,Math.min(1.4,S.qrZoom+(b.dataset.qrZoom==="in"?.15:-.15)));renderDesk();return;}
    if(b.dataset.qrReplay){
      if(b.dataset.qrReplay==="live"){S.qrReplay=null;S.qrReplayToken=(S.qrReplayToken||0)+1;renderDesk();return;}
      await replayQR();return;
    }
    if(b.hasAttribute('data-basket-add')||b.hasAttribute('data-basket-remove')){
      if(b.hasAttribute('data-basket-add')){if(S.basket.length<20)S.basket.push({description:'',quantity:'1',price:'1.00'});}
      else if(S.basket.length>1)S.basket.splice(Number(b.dataset.basketRemove),1);
      sessionStorage.setItem('tf.basket',JSON.stringify(S.basket));renderPhone();return;
    }
    if(b.dataset.customerReceipt){const receipt=b.dataset.customerReceipt==='issued'?S.sim?.issued_receipt:S.sim?.receipt_draft;QRReceipt.customer(receipt,S.sim?.id);return;}
    if(b.hasAttribute('data-receipt-correct')){
      const receipt=[...S.staffCase.evidence].reverse().find(e=>e.kind==='customer_supplied'&&e.blob?.mime?.startsWith('image/'));
      openDialog('Correct receipt transcript',`${textarea('dialog','text','Visible receipt wording',receipt.revisions.at(-1).text,'required maxlength="4000" rows="12"')}${textarea('dialog','reason','Reason for correction','','required maxlength="1000" rows="3"')}${note('The image stays unchanged. A correction requires a new scan and field review.')}`,async values=>caseAction('correct',{evidence_id:receipt.id,text:values.get('text'),reason:values.get('reason')}),'Save correction','PRESERVED EVIDENCE');return;
    }
    if (b.dataset.check) {
      if(["receipt_scan","marketplace"].includes(b.dataset.check)){await runQRCheck(b.dataset.check);return;}
      await busy(
        "staff",
        "Checking " + b.dataset.check + " source…",
        async () => {
          const c = await caseAction("check", { kind: b.dataset.check });
          toast(c.checks.at(-1).result);
        },
      );
      return;
    }
    if (b.dataset.qrVerdict) {
      await busy("staff", "Saving the operator verdict…", async () => {
        await mutate("staff", "/cases/" + S.staffCase.id + "/qr-action", { version: S.staffCase.version, evidence_version:S.staffCase.evidence_version, action: "verdict", verdict: b.dataset.qrVerdict, reason: "Saved after receipt and Marketplace review." });
        await sync(true);
      });
      return;
    }
    if (b.dataset.qrAction) {
      await busy("staff", b.dataset.qrAction === "handoff" ? "Creating human handoff…" : "Saving simulated refund…", async () => {
        await mutate("staff", "/cases/" + S.staffCase.id + "/qr-action", { version: S.staffCase.version, evidence_version:S.staffCase.evidence_version, action: b.dataset.qrAction, reason: "Saved from the QR investigation workspace." });
        await sync(true);
        if(b.dataset.qrAction==="complete_refund"){
          for(const [node,label] of [["refund_request","Refund request reaches the synthetic payment service"],["refund_posted","Completed refund returns to the customer"],["customer_notification","Customer receives the saved completion update"]]){
            S.qrAnimation={kind:"refund",node,label};renderDesk();await revealPause();
          }
          S.qrAnimation=null;render();
        }
      });
      return;
    }
    if(b.dataset.qrSection){
      $("#action-dialog").close();setView(b.dataset.qrSection==="customer"?"phone":"desk",true);
      if(b.dataset.qrSection!=="customer")S.staffTab="overview";
      render();const target=b.dataset.qrSection==="customer"?$("#phone-content"):$("#qr-"+b.dataset.qrSection)||$("#desk");
      target.setAttribute("tabindex","-1");target.focus({preventScroll:true});target.scrollIntoView({block:"start"});return;
    }
    if (b.dataset.modal) {
      actionDialog(b.dataset.modal);
      return;
    }
    if (b.dataset.resolve) {
      actionDialog("resolve", b.dataset.resolve);
      return;
    }
    if (b.dataset.correct) {
      actionDialog("correct", b.dataset.correct);
      return;
    }
    if (b.dataset.claim) {
      actionDialog("claim", b.dataset.claim);
      return;
    }
    if (b.dataset.original) {
      const ev = S.staffCase.evidence.find(
        (ev) => ev.id === b.dataset.original,
      );
      await download(
        "/evidence/" + ev.id + "/file",
        ev.id +
          (ev.blob?.mime === "image/png"
            ? ".png"
            : ev.blob?.mime === "image/jpeg"
              ? ".jpg"
              : ".txt"),
      );
      return;
    }
    switch (b.dataset.action) {
      case "new-purchase":
        newPurchase();
        break;
      case "attempt-qr":
        await busy("customer", "Sending the QR payment…", () =>
          simAction("attempt_qr"),
        );
        break;
      case "refresh-qr":
        await busy("customer", "Checking payment status…", () =>
          simAction("refresh_qr"),
        );
        break;
      case "observe-debit":
        await busy("customer", "Loading later bank activity…", () =>
          simAction("observe_debit"),
        );
        break;
      case "attach-sample-receipt":
        await busy("customer", "Attaching the receipt…", () =>
          simAction("attach_sample_receipt"),
        );
        break;
      case "steps":
        openDialog("Journey steps", $("#journey").innerHTML, null, "", "QR + CASH");break;
      case "sections":
        openDialog("Navigate workspace", `<nav class="qr-drawer-links"><button type="button" class="button secondary" data-qr-section="customer">Customer</button><button type="button" class="button secondary" data-qr-section="evidence">Evidence</button><button type="button" class="button secondary" data-qr-section="marketplace">Marketplace</button><button type="button" class="button secondary" data-qr-section="outcome">Outcome</button></nav>`,null,"","QR + CASH");break;
      case "report":
        S.phone = "report";
        renderPhone();
        $("#phone-content").scrollTop = 0;
        break;
      case "phone-back":
        S.phone = S.phone === "case" ? "cases" : "flow";
        renderPhone();
        break;
      case "resume":
        S.phone = S.sim?.case_id ? "case" : "flow";
        if (S.sim?.case_id)
          S.customerCase = await api("customer", "/cases/" + S.sim.case_id);
        renderPhone();
        break;
      case "inbox":
        S.staffCase = null;
        renderDesk();
        renderLab();
        break;
      case "refresh":
        await sync(true);
        toast("The latest saved case data is loaded.");
        break;
      case "analyze":
        await analyze();
        break;
      case "acknowledge":
        await busy("staff", "Accepting handoff…", () =>
          caseAction("acknowledge"),
        );
        toast("Handoff accepted. Ownership and open requests were updated.");
        break;
      case "clear-reply":
        S.selectedTask = null;
        renderPhone();
        break;
      case "export":
        await download(
          "/cases/" + S.staffCase.id + "/dossier",
          S.staffCase.reference + "-dossier.md",
        );
        break;
      case "evaluation":
        await showEvaluation();
        break;
      case "advance-seeded":
        S.tokens.judge = await api(null, "/session", {
          method: "POST",
          body: JSON.stringify({ role: "judge" }),
        });
        await mutate("judge", "/demo/advance", {});
        toast(
          "Seeded repayment source is available. Open the saved repayment example and run its repayment check.",
        );
        break;
      case "close-dialog":
        if (!S.busy.staff) $("#action-dialog").close();
        break;
      case "retry":
        await boot();
        break;
      case "help":
        openDialog(
          "You’re inside the whole payment story.",
          `<div class="help-steps"><p><b>01 · Customer.</b> Create a purchase, press Pay with QR, see the unconfirmed result, and record cash. Keep the issued receipt.</p><p><b>02 · Evidence.</b> Observe the later bank debit, attach the receipt, review its transcript and file the complaint.</p><p><b>03 · Operator.</b> Scan the receipt with OpenCV visual region detection, then query the synthetic Marketplace records for this exact purchase.</p><p><b>04 · Outcome.</b> Matching records propose a refund requiring operator approval. Rejection sends an explanation. Uncertainty pauses automation and saves an owned human handoff.</p></div>${note("No real money moves. OpenCV is not OCR or authentication. A customer receipt is evidence, not source authority.")}`,
          null,
          "",
          "INTERACTIVE LAB",
        );
        break;
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (form.id === "dialog-form") return;
  e.preventDefault();
  const f = new FormData(form);
  const draft = form.dataset.draft;
  try {
    if (form.id === "purchase-form")
      await busy("customer", "Creating your purchase…", async () => {
        S.customerCase=null;S.staffCase=null;
      S.sim = await mutate("customer", "/simulations", {
          customer_name: f.get("customer_name"),
          merchant: f.get("merchant"),
          merchant_address:f.get('merchant_address'),
          line_items:S.basket.map((row,i)=>({description:f.get('basket-description-'+i),quantity:Number(f.get('basket-quantity-'+i)),unit_price_minor:minor(f.get('basket-price-'+i))})),
          tax_minor:minor(f.get('tax_minor')||'0',true),
          qr_amount_minor: minor(f.get("qr_amount_minor")),
          profile: S.profile,
        });
        rememberSelection();
        S.phone = "flow";
        clearDraft(draft);
        await sync(true);
      });
    if (form.id === "cash-form")
      await busy("customer", "Saving your cash entry…", async () => {
        await simAction("pay_cash", {
          amount_minor: minor(f.get("amount_minor")),
        });
        clearDraft(draft);
      });
    if(form.id==="receipt-draft-form"){
      await busy("customer","Saving receipt evidence…",async()=>{
        const image=f.get("file");const transcript=f.get("transcript");
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await image.arrayBuffer()))).map(b=>b.toString(16).padStart(2,"0")).join("");
        const sig="receipt:"+S.sim.id+":"+digest+":"+transcript;
        const pending=read("tf.receiptPending",null);
        const op=pending?.signature===sig?pending:{signature:sig,key:crypto.randomUUID(),version:S.sim.version};
        sessionStorage.setItem("tf.receiptPending",JSON.stringify(op));
        f.set("version",String(op.version));
        S.sim=await api("customer","/simulations/"+S.sim.id+"/receipt",{method:"POST",body:f,headers:{"Idempotency-Key":op.key}});
        sessionStorage.removeItem("tf.receiptPending");S.phone="flow";rememberSelection();clearDraft(draft);await sync(true);
      });
    }
    if (form.id === "report-form") {
      await busy("customer", "Submitting your complaint…", async () => {
        const submittedSim=S.sim.id;
        const result = await mutate(
          "customer",
          "/simulations/" + S.sim.id + "/complaint",
          {
            version: S.sim.version,
            description: f.get("description"),
            receipt_text: f.get("receipt_text"),
            ...(S.sim.receipt_draft?.id ? { receipt_evidence_id: S.sim.receipt_draft.id } : {}),
          },
        );
        if(S.sim?.id!==submittedSim){toast('Complaint saved for the submitted purchase. Open it from saved journeys.');return;}
        S.sim = result.simulation;
        S.customerCase = result.case;
        S.phone = "case";
        S.customerTab = "summary";
        rememberSelection();
        clearDraft(draft);
        await selectStaffCase(result.case.id);
        await sync(true);
        toast("Your complaint is saved as " + result.case.reference + ".");
      });

    }
    if (
      form.id === "customer-message-form" ||
      form.id === "staff-message-form"
    ) {
      const role = form.id.startsWith("customer") ? "customer" : "staff",
        c = role === "customer" ? S.customerCase : S.staffCase;
      await busy(role, "Saving your message…", async () => {
        const response = await mutate(role, "/cases/" + c.id + "/messages", {
          version: c.version,
          text: f.get("text"),
          ...(role === "customer" && S.selectedTask
            ? { task_id: S.selectedTask }
            : {}),
        });
        if (role === "customer") {
          S.customerCase = response;
          S.selectedTask = null;
        } else S.staffCase = response;
        clearDraft(draft);
        await sync(true);
      });
    }
    if (form.id === "upload-form")
      await busy("customer", "Preserving your evidence…", async () => {
        const file = S.file || f.get("file");
        if (!file?.size) throw Error("Choose a receipt or document first.");
        if (file.size > 2 * 1024 * 1024)
          throw Error("Maximum file size is 2 MiB.");
        if (
          file.type.startsWith("image/") &&
          !String(f.get("transcript") || "").trim()
        )
          throw Error("Add the visible image wording as a human transcript.");
        S.customerCase = await uploadEvidence(file, f.get("transcript") || "");
        S.file = null;
        clearDraft(draft);
        await sync(true);
        toast("Evidence saved. Your investigator can review the original.");
      });
  } catch (error) {
    const id = {
      "purchase-form": "purchase-error",
      "cash-form": "cash-error",
      "report-form": "report-error",
      "customer-message-form": "customer-message-error",
      "staff-message-form": "staff-message-error",
      "upload-form": "upload-error",
      "receipt-draft-form":"receipt-draft-error",
    }[form.id];
    const target = id && document.getElementById(id);
    if (target) target.textContent = error.message;
    toast(error.message, true);
  }
});
$("#dialog-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.modal?.action || S.busy.staff) return;
  const f = new FormData(e.target);
  $("#dialog-submit").disabled = true;
  $("#dialog-error").textContent = "";
  try {
    const result = await busy("staff", "Saving case action…", () =>
      S.modal.action(f),
    );
    $("#action-dialog").close();
    toast(result?.message || "Action saved to the case.");
  } catch (error) {
    $("#dialog-error").textContent = error.message;
  } finally {
    $("#dialog-submit").disabled = false;
  }
});
$("#action-dialog").addEventListener("cancel", (e) => {
  if (S.busy.staff) e.preventDefault();
});
document.addEventListener("keydown", (e) => {
  if (
    !e.target.matches('[role="tab"]') ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
  )
    return;
  e.preventDefault();
  const nodes = [
    ...e.target.closest('[role="tablist"]').querySelectorAll('[role="tab"]'),
  ];
  const i = nodes.indexOf(e.target);
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? nodes.length - 1
        : (i + (e.key === "ArrowRight" ? 1 : -1) + nodes.length) % nodes.length;
  nodes[next].focus();
  nodes[next].click();
});
async function restoreJourney() {
  const q=new URLSearchParams(location.search);
  setView(q.get("view")||"both");
  S.customerCase=null;S.staffCase=null;S.sim=null;S.qrReplay=null;S.qrSelected=null;
  const simId=q.get("simulation"),caseId=q.get("case");
  if(simId)S.sim=await api("customer","/simulations/"+encodeURIComponent(simId));
  if(caseId){
    if(S.view==="desk"){
      await selectStaffCase(caseId);
      try{S.customerCase=await api("customer","/cases/"+encodeURIComponent(caseId));}catch(error){if(error.status!==404)throw error;}
    }else S.customerCase=await api("customer","/cases/"+encodeURIComponent(caseId));
  }
  if(caseId && simId && (S.customerCase?.simulation_id||S.staffCase?.simulation_id)!==simId)throw Error("This case does not belong to the requested simulation. Open the matching saved journey.");
  if(S.sim?.case_id && !S.customerCase)S.customerCase=await api("customer","/cases/"+S.sim.case_id);
  if(S.customerCase){
    if(!S.sim&&S.customerCase.simulation_id)S.sim=await api("customer","/simulations/"+S.customerCase.simulation_id);
    await selectStaffCase(S.customerCase.id);
  }
  S.phone=S.customerCase?"case":S.sim?"flow":"purchase";
  updateJourneyLinks();render();
}
async function boot() {
  try {
    await ensureSession("customer");await ensureSession("staff");await sync(true);
    await restoreJourney();S.ready=true;
  } catch(error) {
    S.sim=null;S.customerCase=null;S.staffCase=null;S.ready=true;
    render();
    toast("Requested journey unavailable: "+error.message+" Use Start new scenario or choose a saved journey.",true);
  }
}
window.addEventListener("popstate",()=>restoreJourney().catch(error=>{
  S.sim=null;S.customerCase=null;S.staffCase=null;S.phone="purchase";render();toast(error.message,true);
}));
setInterval(() => {
  if (S.ready && !document.hidden) sync();
}, 3000);
setInterval(() => ($("#phone-clock").textContent = clock()), 10000);
$("#phone-clock").textContent = clock();
boot();
