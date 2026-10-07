# DataDNA in the add-money simulation

Every piece of customer data that moves through an add-money payment, and every read the AI makes during an
investigation, must answer five questions first. The answers are rules, not a model (`tracefix/transfer/datadna.py`).

| Gate | Question | MFS term | What it asks |
| --- | --- | --- | --- |
| 1 | Why? | Customer consent | Did the customer ask for this transfer, and is the data needed to complete or resolve it? |
| 2 | Who? | Parties | Which of customer, bank, wallet partner or operator is asking, and may they see it on this payment? |
| 3 | Where? | Systems | Does it stay inside this payment's bank, connector and wallet records, with no other holder's data? |
| 4 | How? | Masking | Only the needed fields, read-only, with account and wallet numbers (MSISDN) masked? |
| 5 | Until when? | Retention | Is there a transaction-record retention schedule, and when does it expire? |

## Runs alongside the payment

When a payment is created the engine opens a purpose-bound **processing envelope** for it. Each hand-off then gets a
saved DataDNA review on the run clock, in step with the payment itself:

1. Customer request (customer app to add-money service)
2. Issuing bank (funding debit)
3. Wallet partner (credit instruction)
4. Partner reply (acknowledgement)
5. Customer status (message to the customer)

The reviews decide only from saved facts (for example, how many wallets the reference maps to), never from the hidden
scenario label, and they do not change the scripted outcome of a scenario.

- **Funnel and journey (board, top band).** The funnel shows the five gates; under it, five chips follow the payment as
  it moves: done, in progress, held at a gate (red), or stopped (red, "no reply") where the run is waiting. Click the
  band (or press `D`) to open the ledger, or click a chip to open that hand-off.
- **DNA ledger (popup).** Opens on *Payment journey*: a banner says where the payment is or where it stopped and why,
  the left list is the five hand-offs, and the right side shows the selected hand-off's five answers, gate checks,
  field-level decisions (released, masked, withheld, excluded) and any concerns with how they were handled and the
  compliant alternative. Further tabs list every data call, all concerns, and the compliance plan.
- **Evidence.** Reviews are saved as `DATADNA_ENVELOPE`, `DATADNA_REVIEWED` and `DATADNA_PLAN` events in the immutable
  journal, so replay and the operator report show exactly what the live board showed. Customers never receive these
  events.

Limits that matter: flow reviews classify simulated hand-offs; principle names are a plain-language mapping and need
review by counsel; retention periods are fixture settings (`TRACEFIX_DATADNA_RETENTION_DAYS`, default 90) and deletion
is recorded, not executed; the AI's "follow-up requests" are scripted by the rules planner as realistic over-reach
attempts so refusals can be shown.

Try it: `python scripts/datadna_seed.py mapping_ambiguity`, open the printed URL straight away to watch the journey
fill in live, then start the investigation.
