# Add-money investigation (standalone pages)

A bank-funded wallet top-up that stalls, and the staff investigation that follows it. It lives on its own pages and
shares no markup, script or stylesheet with the existing workspace.

| Page | Path | Purpose |
|---|---|---|
| Customer | `/customer/payment`, `/customer/payment/{id}`, `/customer/cases/{id}` | Submit a top-up, follow progress, report an issue |
| Operations | `/admin/queue`, `/admin/cases/{payment or case id}`, `/admin/cases/{id}/report` | Trace graph, evidence, hypotheses, plan, replay, report |
| MFS (start here) | `/mfs` | The whole walkthrough on one page: five steps that track the run, scenario choice, run reset, processing clock, and buttons that open the other two pages |

`/mfs` is also linked from the main site navigation, and the operations page has an **MFS** button back to it. `/demo`
redirects to `/mfs`.

Open `/mfs` first, choose a scenario and follow the five steps. Each step highlights as the run reaches it
(customer adds money, credit stays unconfirmed, staff investigate, decide and report) and its button opens the matching
page in a separate tab. Each tab holds its own scoped session in `sessionStorage`, so the tabs never overwrite each other.

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
