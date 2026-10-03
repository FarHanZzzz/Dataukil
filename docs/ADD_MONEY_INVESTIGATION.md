# DataUkil / Add money

A bank-funded wallet top-up and the investigation that follows an unconfirmed transfer. The homepage gives it its own header and hero actions and a dedicated feature before the statistics and QR content. Its page family remains independent of the QR lab, transfer dashboard and AI Studio.

| Page | Path | Purpose |
|---|---|---|
| Customer | `/customer/payment`, `/customer/payment/{id}`, `/customer/cases/{id}` | Submit a top-up, follow progress, report an issue |
| Operations | `/admin/queue`, `/admin/cases/{payment or case id}`, `/admin/cases/{id}/report` | Trace graph, evidence, hypotheses, plan, replay, report |
| Add money (start here) | `/mfs` | Five-stage guide, scenario setup, exact-run resume, recent journeys and expandable presentation controls |

`/demo` redirects to `/mfs`. The board retains its existing **MFS** return control on desktop to preserve the original layout; its accessible label identifies the Add money walkthrough and its link carries the saved run.

Open `/mfs` first and explicitly choose one of four scenarios. An automatically created empty backend run does not count as a selection. **Start walkthrough** creates the run and opens the customer form in the same tab. Technical premises and expected endings are expandable presenter details.

| Walkthrough stage | Main action |
|---|---|
| 1. Choose a scenario | Choose the simulated situation and start the journey |
| 2. Add money | Enter an amount, select a bank, review and confirm |
| 3. Track the transfer | Read the saved processing or unconfirmed payment status |
| 4. Investigate | Follow the existing board's source checks |
| 5. Outcome and report | Review the saved decision, confirmed credit or owned follow-up |

The guide shows completed, current and upcoming stages. Mobile shows the current stage plus **View all steps**. Walkthrough progress is separate from the four financial stages labeled **Transfer progress** and never confirms wallet credit by itself.

**Continue walkthrough** derives its destination from saved progress: processing opens the existing payment, incidents open its investigation, a decision opens the board's existing approval controls, and an outcome opens its report when a case exists. Completed Add money steps also return to the existing payment instead of creating another one. **Open companion investigation view** explicitly opens a second tab for a side-by-side presentation.

Navigation between the main site, walkthrough, customer and staff documents uses document navigation. Navigation within a page family retains browser history. Modifier clicks, new tabs, downloads and anchors retain native behavior. Known run ids travel through status, board, report and return links; unrelated recent payments never inherit a session's current run. `/mfs?run=…` selects exactly that run, with explicit recovery if it is missing from the API's twelve recent runs. Replacement journeys refresh the presenter session. Archived records remain readable and active-run controls are disabled. A fresh direct form bookmark opens the guide to check availability before enabling a submission. Staff bookmarks verify availability independently, without changing the active staff token; customer pages never request staff or presenter projections. The server remains authoritative for submissions, evidence and corrections.

Customer amount/bank drafts and the review step survive refresh in tab-scoped storage without submitting. Pending submissions retain their idempotency key through uncertain responses and retries. Complaint drafts persist while live status updates reuse their textarea and restore focus. Status pages lead with the current status, amount/accounts and next action before transfer progress, investigation and updates. An owned handoff remains visibly different from confirmed wallet credit.

The homepage Add money entry, walkthrough, customer pages and report use the landing page's navy and electric-blue theme through scoped tokens in `static/pay/css/palette.css` and presentation rules in `static/pay/css/landing.css`. Deep navy (`#01040F`) provides the canvas and layered navy (`#040D2A`) provides card surfaces. Electric blue (`#4DA3FF`) identifies primary actions and selections; pale blue (`#8FD3FF`) identifies information and processing; green (`#7FE3C3`) identifies confirmed success; amber (`#F4C26B`) identifies uncertainty; red (`#FF8A94`) identifies errors. Status text and icons accompany these colors. Processing and an owned follow-up never inherit the confirmed-credit treatment.

Plus Jakarta Sans, Geist and JetBrains Mono provide headings, interface text and references respectively. The walkthrough echoes the landing page's chrome display type, mountain atmosphere, luminous button edges and precise panel framing. Shared card, control and icon radii, borders, focus indicators and muted text keep the surrounding pages consistent. Reports use a cool paper surface (`#F3F7FD`) with dark ink inside matching dark navigation, an explicit outcome summary, return links and Markdown/HTML exports. Wide tables scroll within their own keyboard-accessible regions. The namespaced palette does not override the desktop investigation board's existing tokens.

The entry page offers four large scenario cards with short descriptions, optional **Presenter notes**, a selected-story message and one **Start walkthrough** button. Mobile keeps that button in a visible selection bar after a choice. Saved journeys show their current task before new scenario setup. **Explore investigation demo** and the entire illustrated **Open investigation workspace** card provide prominent same-tab access: they open the chosen run's payment when available, its queue otherwise, or a saved recent investigation on a fresh visit. The preview is decorative and makes no financial claim; it never submits a payment. Customer status includes a prominent **Open investigator demo view** action with an explanation of the workspace.

The desktop investigation graph module and `pay.css` behavior remain unchanged. The surrounding workspace chrome is refreshed in the scoped `board.css`: the queue, top rail, canvas framing, inspector, toolbar and activity log now use DataUkil's navy/electric-blue landing language. Topology, nodes, edges, camera behavior, selection, replay, citations, approval and exports remain the same. At widths up to 1040px, **Queue** opens a modal drawer and **Board**, **Details** and **Activity** expose the existing canvas, inspector and log. Selecting a node opens Details with the original Evidence/Hypotheses/Plan tabs. The primary investigation control remains visible; **More** holds secondary actions. Canvas controls wrap without changing their behavior.

## Running

```bash
PYTHONPATH=. .venv/bin/python -m uvicorn tracefix.app:app --host 0.0.0.0 --port ${PORT:-8000}
```

The tables are created on start by `tracefix/transfer/schema.py` (`CREATE ... IF NOT EXISTS`). Settings are in
`.env.example`.

## What happens in a run

1. The customer confirms an amount and a masked bank source. The request carries an `Idempotency-Key`; repeating it
   returns the same payment, and a second click cannot create a second one.
2. The processing engine writes bank, connector and wallet records on the run clock. Each state change is committed
   together with the journal event that announces it.
3. If the outcome stays unconfirmed past the incident threshold, a case opens and the customer page says that the
   wallet credit has not been confirmed yet.
4. Staff press **Start investigation**. A bounded set of read-only checks runs. Each returns an observation (`OBS-…`)
   that lights the matching node on the graph, and hypotheses change only when an observation supports them.
5. The result is either a proposed correction awaiting approval, or a blocked correction with an owned handoff.
6. Replay rebuilds the graph from saved events up to a chosen point and never re-runs anything.

## Scenarios

| Scenario | Records the partners write | Investigation outcome |
|---|---|---|
| Retryable wallet worker fault | Funding posts, the credit worker fails before crediting | Proposes resuming the original once; approval gives a single credit |
| Lost acknowledgement | Credit exists, acknowledgement and callback never arrive | Proposes refreshing the customer status; no money moves |
| Mapping ambiguity, missing authority | Source records cannot be bound to the intent, a source is unreachable | Correction blocked; owned handoff and report |
| Late original completion | Original processing is only delayed | Advises waiting; a late credit updates the same case and supersedes a stale plan |

The scenario label is read only inside `engine.py`, to decide which records the partners write. Tools, policy, contract
and investigation never read it (`tests/test_transfer.py` scans for that). The staff snapshot does not expose it.

## Money safety

- Amounts are integer minor units. Postings are balanced and immutable (SQLite triggers), `UNIQUE(payment_id, leg)`.
- Crediting the wallet takes one serialized claim (`UPDATE ... fulfillment='fulfilled' WHERE fulfillment='open'`), so an
  original credit and a correction racing each other produce one credit.
- A correction is bound to the evidence version it was proposed on. A new observation or material change bumps the
  version and approving the old plan is refused. Approvals are idempotent.
- No investigator tool moves money. `RETURN_FUNDS` is always ineligible.
- `TRACEFIX_SANDBOX_CORRECTIONS=0` blocks money-moving plans while leaving everything else available.
- The existing QR routes cannot reach this engine, and `/api/cases` excludes add-money cases.

## Investigation mode

The policy in `tracefix/transfer/policy.py` is rules-based and labelled once in the inspector as "Rules-based
investigation". It cites observation ids for every status change. No model is called.

## Reset

`POST /api/transfer/runs` with `replaces` starts a new run identity. Earlier runs stay readable and no existing project
records are touched.

## Roll back

Drop the `tx_*` tables (and their triggers) and remove `tracefix/transfer/`, `tracefix/auth.py` and `static/pay/`. The
legacy tables are not modified by this feature.

## Tests

```bash
PYTHONPATH=. .venv/bin/python -m pytest tests/test_transfer.py tests/test_workflow.py -q
```

Browser acceptance checks use an isolated temporary database and drive the existing simulated clock explicitly:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright-core TRACEFIX_CHROME=/path/to/chrome node scripts/check_add_money_ui.mjs
```

With Playwright installed normally, omit `PLAYWRIGHT_MODULE`. `TRACEFIX_KEEP_UI_ARTIFACTS=1` retains the temporary database and assertion record; failures also retain a browser trace. Checks cover all four financial endings, uncertain HTTP responses and repeated confirmation, draft/review persistence, live complaint focus, same-tab/companion and modifier navigation, Back/Forward with a delayed response, exact/archived/unavailable runs, exports, replay, zoom/pan, citations, keyboard focus and widths 320, 390, 768, 1024, 1440 and 1920px. See [the UI validation record](ADD_MONEY_UI_VALIDATION.md).
