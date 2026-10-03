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
function minor(value) {
  const v = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v))
    throw Error("Enter a positive amount with at most two decimal places.");
  const [whole, dec = ""] = v.split(".");
  const n = Number(whole) * 100 + Number(dec.padEnd(2, "0"));
  if (n < 1 || n > 100000000)
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
function snapshot(el) {
  return {
    focus: el.contains(document.activeElement)
      ? {
          id: document.activeElement.id,
          start: document.activeElement.selectionStart,
          end: document.activeElement.selectionEnd,
        }
      : null,
    scroll: [...el.querySelectorAll("[data-scroll]")].map((n) => ({
      key: n.dataset.scroll,
      top: n.scrollTop,
      bottom: n.scrollHeight - n.scrollTop - n.clientHeight < 35,
    })),
  };
}
function restore(el, s) {
  for (const old of s.scroll) {
    const n = el.querySelector(`[data-scroll="${old.key}"]`);
    if (n)
      n.scrollTop =
        old.key === "thread" && old.bottom ? n.scrollHeight : old.top;
  }
  if (s.focus?.id) {
    const n = document.getElementById(s.focus.id);
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
  el.innerHTML = html;
  restore(el, s);
}
function clearDraft(form) {
  delete S.drafts[form];
  sessionStorage.setItem("tf.drafts", JSON.stringify(S.drafts));
}
function rememberSelection() {
  localStorage.setItem("tf.activeSim", S.sim?.id || "new");
  if (S.customerCase) localStorage.setItem("tf.activeCase", S.customerCase.id);
  else localStorage.removeItem("tf.activeCase");
}
function setView(view) {
  S.view = view;
  $("#workspace").className = "workspace view-" + view;
  document.querySelectorAll("[data-view]").forEach((n) => {
    n.classList.toggle("active", n.dataset.view === view);
    n.setAttribute("aria-pressed", String(n.dataset.view === view));
  });
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
          : 4;
  if (c?.status === "OUTCOME_RECORDED") at = 5;
  const steps = [
    ["Purchase", "Enter the details"],
    ["QR payment", "Try the app"],
    ["Second payment", "Record the cash"],
    ["Report", "Tell us what happened"],
    ["Investigation", "Follow the evidence"],
    ["Outcome", "Read the review"],
  ];
  $("#journey").innerHTML = steps
    .map(
      ([title, sub], i) =>
        `<div class="journey-step ${i === at ? "current" : i < at ? "complete" : ""}" ${i === at ? 'aria-current="step"' : ""}><span class="step-number">${i < at ? icon("check") : String(i + 1).padStart(2, "0")}</span><div><strong>${title}</strong><small>${sub}</small></div>${i < 5 ? '<span class="step-connector"></span>' : ""}</div>`,
    )
    .join("");
}
function phoneTitle(title, sub = "", back = false) {
  $("#phone-header").innerHTML =
    `${back ? `<button class="icon-button" data-action="phone-back" aria-label="Back">${icon("back")}</button>` : '<span class="wallet-mark">t↗</span>'}<div><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</div><span class="avatar">${esc((S.sim?.customer_name || "You").slice(0, 1))}</span>`;
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
          : "trace wallet",
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
function purchaseScreen() {
  return `<div class="app-kicker">LET’S START AT THE COUNTER</div><h2>A purchase,<br>in your hands.</h2><p class="app-description">Enter your own details to begin the payment story.</p><form id="purchase-form" data-draft="purchase" class="app-form">
 ${field("purchase", "customer_name", "Your name", "Farhan", "text", 'required maxlength="80" autocomplete="given-name"')}
 ${field("purchase", "merchant", "Merchant name", "Rafi Store", "text", 'required maxlength="100"')}
 ${field("purchase", "item", "What are you buying?", "Groceries", "text", 'required maxlength="120"')}
 <div class="field-row">${field("purchase", "total_minor", "Invoice total (৳)", "500.00", "text", 'required inputmode="decimal"')}${field("purchase", "qr_amount_minor", "QR payment (৳)", "500.00", "text", 'required inputmode="decimal"')}</div>
 <p class="field-hint">For split tender, enter a QR amount below the invoice total.</p><p class="form-error" id="purchase-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Continue to payment"} ${icon("arrow")}</button>
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
    return `<div class="result-symbol amber">${icon("alert")}</div><div class="app-kicker">AT THE COUNTER</div><h2>The result is unclear.</h2><p class="app-description">The app lost the payment response. You don’t yet know if the QR payment went through.</p>${merchantCard(sim)}${note("An unclear screen does not mean the payment failed. This story simulates the customer’s choice to pay cash.", "warning")}<form id="cash-form" data-draft="cash-${sim.id}" class="app-form">${field("cash-" + sim.id, "amount_minor", "Cash paid at the counter (৳)", amount(sim.total_minor === sim.qr_amount_minor ? sim.total_minor : sim.total_minor - sim.qr_amount_minor), "text", 'required inputmode="decimal"')}<p class="form-error" id="cash-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Record cash payment"} ${icon("cash")}</button></form><button class="button secondary full" data-action="refresh-qr"${disabled("customer")}>Check QR status first</button>`;
  if (sim.stage === "SECOND_PAID")
    return `<div class="result-symbol green">${icon("cash")}</div><div class="app-kicker">SECOND PAYMENT RECORDED</div><h2>You paid ${money(sim.cash_amount_minor)} cash.</h2><p class="app-description">Your cash entry is saved. Let’s check what happened to the original QR payment.</p>${merchantCard(sim)}<div class="payment-tile"><span>${icon("scan")}</span><div><strong>QR payment</strong><small>Waiting for a clear result</small></div><b>${money(sim.qr_amount_minor)}</b></div><div class="payment-tile"><span>${icon("cash")}</span><div><strong>Cash payment</strong><small>Reported by you · not yet checked</small></div><b>${money(sim.cash_amount_minor)}</b></div><button class="button primary full" data-action="refresh-qr"${disabled("customer")}>${S.busy.customer || "Check QR payment status"} ${icon("refresh")}</button><button class="button secondary full" data-action="report">Report the problem now</button>`;
  const complete = sim.qr_status === "COMPLETED";
  return `<div class="result-symbol ${complete ? "amber" : "green"}">${icon(complete ? "receipt" : "check")}</div><div class="app-kicker">PAYMENT STATUS UPDATED</div><h2>${complete && sim.cash_amount_minor ? "One purchase.<br>Two payment entries." : complete ? "Your QR payment completed." : "The QR did not complete."}</h2><p class="app-description">${complete ? "The provider’s fictional record now shows the QR payment completed." : "The fictional provider records no completed QR payment."} ${sim.cash_amount_minor ? "Your cash entry is also saved. An investigator can check how the records fit together." : ""}</p>${merchantCard(sim)}<div class="payment-tile"><span>${icon("scan")}</span><div><strong>QR · ${complete ? "Completed" : "Not completed"}</strong><small>${esc(sim.qr_reference)}</small></div><b>${money(complete ? sim.qr_amount_minor : 0)}</b></div>${sim.cash_amount_minor ? `<div class="payment-tile"><span>${icon("cash")}</span><div><strong>Cash · Reported</strong><small>Merchant confirmation still needed</small></div><b>${money(sim.cash_amount_minor)}</b></div>` : ""}${receiptRows(sim)}${sim.cash_amount_minor ? `<button class="button primary full" data-action="report">Report paying twice ${icon("arrow")}</button>` : `<button class="button primary full" data-action="new-purchase">Start another purchase ${icon("plus")}</button>`}<button class="button secondary full" data-phone-nav="activity">View payment timeline</button>`;
}
function defaultComplaint(sim) {
  return `I tried to pay ${money(sim.qr_amount_minor)} by QR at ${sim.merchant}, but the result was unclear. I then paid ${money(sim.cash_amount_minor)} cash for ${sim.item}, purchase ${sim.purchase_id}. Please check whether I paid twice for the same purchase.`;
}
function reportScreen() {
  const sim = S.sim,
    form = "report-" + sim.id;
  return `<div class="app-kicker">WE’LL FOLLOW BOTH PAYMENTS</div><h2>Tell us what happened.</h2><p class="app-description">Your payment details are linked. A receipt is optional.</p><div class="report-summary"><span>${icon("receipt")}</span><div><strong>${esc(sim.merchant)}</strong><small>QR ${money(sim.qr_amount_minor)} + cash ${money(sim.cash_amount_minor)}</small><small class="mono">${esc(sim.purchase_id)}</small></div></div><form id="report-form" data-draft="${form}" class="app-form">${textarea(form, "description", "Your complaint", defaultComplaint(sim), 'required maxlength="4000" rows="6"')}${textarea(form, "receipt_text", "Receipt wording (optional)", "", 'maxlength="4000" rows="3" placeholder="Type the wording from a receipt, if you have one."')}<p class="field-hint">English, Bangla and Banglish are welcome. You can attach a file after submitting.</p><p class="form-error" id="report-error" role="alert"></p><button class="button primary full" type="submit"${disabled("customer")}>${S.busy.customer || "Submit complaint"} ${icon("arrow")}</button></form>${note("Your investigator checks the evidence before recording an outcome. Submitting a report does not trigger a repayment.")}`;
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
  if (S.customerTab === "summary")
    body = `<div class="case-status-card"><div>${pill(statusName(c.status), c.status === "OUTCOME_RECORDED" ? "green" : "neutral")}<span class="mono">${esc(c.reference)}</span></div><h3>${esc(c.purchase_label)}</h3><p>${esc(actorName(c.owner))} is responsible for your case.</p><div class="review-time">${icon("activity")}<span>Next review<strong>${date(c.next_review)} · Dhaka</strong></span></div></div>${c.status === "OUTCOME_RECORDED" && c.reviews?.some((r) => r.decision === "OUTCOME_RECORDED" && !r.stale) ? `<div class="customer-request final-review"><span class="app-kicker">YOUR INVESTIGATOR’S OUTCOME</span><p>${esc(c.reviews.filter((r) => r.decision === "OUTCOME_RECORDED" && !r.stale).at(-1).note)}</p><small>Saved ${date(c.reviews.filter((r) => r.decision === "OUTCOME_RECORDED" && !r.stale).at(-1).at)}</small></div>` : ""}${assessmentCard(c.assessment, true, c.analysis_state === "STALE")}${pending.map((t) => `<div class="customer-request"><span class="app-kicker">${t.status === "RESPONDED" ? "YOUR RESPONSE IS SAVED" : "YOUR INVESTIGATOR NEEDS YOU"}</span><p>${esc(t.question)}</p>${t.status === "OPEN" ? `<button class="button primary full" data-reply-task="${esc(t.id)}">Reply to request ${icon("chat")}</button>` : "<small>Your investigator will review your reply.</small>"}</div>`).join("")}<section class="phone-section"><h3>What’s confirmed</h3>${c.confirmed_facts.map((t) => `<p class="confirmed-line">${icon("check")}${esc(t)}</p>`).join("") || '<p class="muted">No payment facts have been confirmed by your investigator yet.</p>'}</section><section class="phone-section"><h3>Latest updates</h3>${c.notifications
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
  let html = `<header class="desk-header"><span class="desk-brand">${icon("shield")}tracefix <small>INVESTIGATIONS</small></span><label class="investigator-select"><span class="sr-only">Investigator identity</span><select id="staff-identity" aria-label="Investigator identity"${disabled("staff")}><option value="staff" ${S.staffRole === "staff" ? "selected" : ""}>Investigator 1</option><option value="other_staff" ${S.staffRole === "other_staff" ? "selected" : ""}>Investigator 2</option></select><span class="presence-dot"></span></label></header>`;
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
    )}<div class="desk-scroll" role="tabpanel" aria-labelledby="staff-tab-${S.staffTab}" data-scroll="desk">${S.staffTab === "overview" ? staffOverview(c) : S.staffTab === "conversation" ? conversation(c, "staff") : S.staffTab === "evidence" ? evidenceScreen(c) : staffActivity(c)}</div><div class="desk-footer"><span class="live-dot"></span><span>${S.busy.staff || "Saved in this workspace"} · Case v${c.version} · Evidence v${c.evidence_version}</span><button class="button quiet small" data-action="refresh">${icon("refresh")}Refresh</button></div>`;
  update($("#desk"), html);
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
function staffOverview(c) {
  const f = c.facts,
    a = c.analysis_fresh ? c.analysis?.assessment : null,
    pending = c.handoffs.find((h) => h.status === "REQUESTED");
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
  renderDesk();
  renderLab();
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
    if (force || deskChanged || !S.staffCase) renderDesk();
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
async function caseAction(action, body = {}) {
  const c = S.staffCase;
  if (!c) throw Error("Open a case first.");
  S.staffCase = await mutate("staff", "/cases/" + c.id + "/" + action, {
    version: c.version,
    ...body,
  });
  await sync(true);
  return S.staffCase;
}
async function simAction(action, body = {}) {
  S.sim = await mutate("customer", "/simulations/" + S.sim.id + "/action", {
    version: S.sim.version,
    action,
    ...body,
  });
  rememberSelection();
  S.phone = "flow";
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
  const form = e.target.closest("form[data-draft]");
  if (form && e.target.name && e.target.type !== "file") {
    S.drafts[form.dataset.draft] ??= {};
    S.drafts[form.dataset.draft][e.target.name] = e.target.value;
    sessionStorage.setItem("tf.drafts", JSON.stringify(S.drafts));
  }
});
document.addEventListener("change", async (e) => {
  try {
    if (e.target.id === "upload-file") {
      S.file = e.target.files[0] || null;
    }
    if (e.target.id === "simulation-profile") S.profile = e.target.value;
    if (e.target.id === "staff-identity") {
      S.staffRole = e.target.value;
      await ensureSession("staff", true);
      renderDesk();
      toast("Switched to " + actorName(S.tokens.staff.actor) + ".");
    }
    if (e.target.id === "saved-simulation" && e.target.value) {
      S.sim = await api("customer", "/simulations/" + e.target.value);
      rememberSelection();
      S.customerCase = S.sim.case_id
        ? await api("customer", "/cases/" + S.sim.case_id)
        : null;
      S.phone = S.customerCase ? "case" : "flow";
      if (S.customerCase) await selectStaffCase(S.customerCase.id);
      render();
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  try {
    if (b.dataset.view) {
      setView(b.dataset.view);
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
    if (b.dataset.customerCase) {
      if (S.busy.customer || S.busy.staff) return;
      await selectCustomerCase(b.dataset.customerCase);
      return;
    }
    if (b.dataset.staffCase) {
      if (S.busy.staff) return;
      await selectStaffCase(b.dataset.staffCase);
      return;
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
    if (b.dataset.check) {
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
          `<div class="help-steps"><p><b>01 · Be the customer.</b> Enter a purchase, try QR, record the cash payment and check the eventual QR result.</p><p><b>02 · Report it.</b> Write your own complaint. The investigator sees the same saved details.</p><p><b>03 · Investigate together.</b> Check sources, request evidence and exchange real case messages. Customer replies invalidate old assessments.</p><p><b>04 · Follow the outcome.</b> Save a cited review. For the repayment stage, use the clearly marked simulation control, then check the record.</p></div>${note("All purchases and records are fictional. The learned text model was trained on synthetic examples; record support is assessed separately. No real transfers are executed.")}`,
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
        S.sim = await mutate("customer", "/simulations", {
          customer_name: f.get("customer_name"),
          merchant: f.get("merchant"),
          item: f.get("item"),
          total_minor: minor(f.get("total_minor")),
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
    if (form.id === "report-form") {
      await busy("customer", "Submitting your complaint…", async () => {
        const result = await mutate(
          "customer",
          "/simulations/" + S.sim.id + "/complaint",
          {
            version: S.sim.version,
            description: f.get("description"),
            receipt_text: f.get("receipt_text"),
          },
        );
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
      analyze().catch((error) =>
        toast(
          "Complaint saved. Assessment could not finish: " + error.message,
          true,
        ),
      );
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
async function boot() {
  try {
    await ensureSession("customer");
    await ensureSession("staff");
    await sync(true);
    const selected = localStorage.getItem("tf.activeSim");
    S.sim =
      selected === "new"
        ? null
        : S.sims.find((s) => s.id === selected) || S.sims[0] || null;
    const savedCase = S.customerCases.find(
      (c) => c.id === localStorage.getItem("tf.activeCase"),
    );
    if (savedCase || S.sim?.case_id) {
      S.customerCase =
        savedCase || (await api("customer", "/cases/" + S.sim.case_id));
      S.sim = S.customerCase.simulation_id
        ? S.sims.find((s) => s.id === S.customerCase.simulation_id) || null
        : null;
      S.phone = "case";
      await selectStaffCase(S.customerCase.id);
    } else S.phone = S.sim ? "flow" : "purchase";
    S.ready = true;
    render();
  } catch (error) {
    toast(error.message, true);
    $("#phone-content").innerHTML =
      `<div class="phone-empty"><h3>Let’s reconnect.</h3><p>${esc(error.message)}</p><button class="button primary" data-action="retry">Retry connection</button></div>`;
    $("#desk").innerHTML =
      '<div class="desk-empty"><h3>Workspace is reconnecting.</h3><p>Start the local server, then retry from the customer app.</p></div>';
  }
}
setInterval(() => {
  if (S.ready && !document.hidden) sync();
}, 3000);
setInterval(() => ($("#phone-clock").textContent = clock()), 10000);
$("#phone-clock").textContent = clock();
boot();
