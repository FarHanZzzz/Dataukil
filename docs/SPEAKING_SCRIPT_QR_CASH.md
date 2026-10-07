# QR + Cash — easy speech + click guide

**Start:** double-click `D:\dataukil\run.bat`
**Open:** http://127.0.0.1:8000/qr-demo

Top tabs you will use:
1. **Live simulation** — see both sides together
2. **Customer status** — the phone
3. **Operator investigation** — the desk

Speak the lines in quotes. Click the bold buttons. When you see **◆ EVIDENCE MOMENT**, pause and say that part clearly.

---

## 0. Open the page

**Click:** QR + cash (or open `/qr-demo`)

**Say:**

> Welcome. This is DataUkil’s QR plus cash demo. One shop bill. The customer pays on the phone. The investigator works on the desk. Same story. Two views.

Point at the three tabs:

> Live simulation shows both sides. Customer status is the phone. Operator investigation is the desk. I start on the phone.

**Click:** Customer status

---

# PART A — Customer phone

## 1. Make a purchase

**Click:** Start new scenario
(If you see Resume saved journey, you can use that instead.)

**Say:**

> First, the customer is shopping. They make a small purchase — about five hundred taka. Basket, merchant, amount. All saved on the phone.

---

## 2. Pay by QR

**Click:** Pay by QR

**Say:**

> Now they try to pay with QR. Same as a real shop. They scan. They tap pay.

Wait for the red / failed screen.

**Say:**

> Look — the phone says the payment failed. Or it never confirms. The customer thinks the QR money never went. So they pay cash.

---

## 3. Pay cash + get receipt

**Click:** Pay cash and get receipt

**Say:**

> Cash is paid at the counter. The phone saves the cash amount and shows the receipt. For the customer, the problem looks solved — they paid, they got paper.

---

## 4. Bank still takes money

**Click:** the next button for bank activity / later debit
(wording: check bank activity / bank debit observed)

**Say:**

> Later they open the bank. The QR amount is still deducted. Now it hurts. They paid cash, and the bank still took the QR money. One purchase. Two payments.

---

## 5. File the complaint

**Click:** File complaint with receipt
Type or keep the complaint text, for example:

`QR fail dekhailo, cash dilam, pore account thekeo katse.`

**Say:**

> So they file a complaint from the same phone. Receipt attached. Case saved. On Customer status they can see the story in simple lines — QR failed on screen, cash paid, bank debit seen, receipt ready.

**◆ EVIDENCE MOMENT — say this now:**

> DataUkil preserves the customer’s original complaint and receipt for review. Filing the complaint does not run a language model or establish that an overpayment occurred. The investigator checks the available sources next.

**Click:** Operator investigation

---

# PART B — Operator desk

## 6. Open the desk

**Say:**

> Same purchase. Same receipt. Same complaint. This is the investigator’s side. The blue button shows the current step. Right now: scan the receipt.

Point at **CURRENT INVESTIGATION STEP**.

---

## 7. Scan the receipt

**Click:** Scan receipt

Watch the scan light move and boxes appear.

**Say:**

> First desk action: Scan receipt. The system looks at the paper image and marks the important areas — shop name, items, total, cash.

Review the fields. Tick the acknowledgement. Write a short note like: `Fields checked.`

**◆ EVIDENCE MOMENT — say this now:**

> This is OpenCV image processing and visual region detection. The investigator can zoom and compare Original, Processed, and Annotated views. Displayed values come from the preserved transcript and need human review; this implementation does not perform OCR or authenticate the receipt. The receipt-integrity panel compares the file’s SHA-256 fingerprint with the saved upload and scan input. A matching fingerprint proves file consistency, not authenticity.

---

## 8. Verify with Marketplace

**Click:** Verify with Marketplace
(enabled after the receipt review)

**Say:**

> Next: Verify with Marketplace. For this exact purchase we check the order and payment picture — QR side, bank side, cash side, amount and items. The investigation board fills in as the checks come back. One place. Full picture.

**◆ EVIDENCE MOMENT — say this now:**

> DataDNA checks the actor, case, purpose, processing basis, and permitted recipient before the exact synthetic source is read. The request uses only permitted purchase and payment fields. The QR workflow compares these records using deterministic rules; this button does not call E5 or Qwen.

---

## 9. Inspect the source comparison

**Click:** the policy and source records on the investigation board.

**Say:**

> The board shows what data was permitted, which exact purchase was checked, and whether the independent payment records corroborate an overpayment. Each result remains tied to its source. Missing records remain uncertainty and require follow-up.
>
> The Marketplace in this demo is a bounded synthetic adapter. No external merchant or bank is contacted.

Open a saved record or comparison result and show its reference and amount. Equal amounts alone do not link two payments to the same purchase.

---

## 10. Record the verdict

**Click:** the button to record the source-grounded verdict
For the happy demo path (matching records): choose **Legitimate**

**Say:**

> Now the operator records the verdict from the sources. When the records show a real overpayment for this purchase, the desk proposes the refund amount. Clear next step.

---

## 11. Approve and finish the refund

**Click:** Approve simulated refund
Then **Click:** Post simulated refund

**Say:**

> Two clicks on purpose. First approve. Then post. So “requested” and “completed” never get mixed. The simulated refund is saved. No real money moves in this demo — but the process is the same shape as a real ops desk.

**◆ EVIDENCE MOMENT — closing line:**

> OpenCV helped inspect the receipt, DataDNA limited the source request, and exact purchase and payment checks supported the operator’s decision. Refund approval and simulated completion are separate saved events.

---

## 12. Back to the customer

**Click:** Customer status

**Say:**

> Back on the phone. Same case. Updated status. The customer sees the outcome in simple language — review ongoing, or simulated refund complete. That is the full QR plus cash journey: customer reported it, the sources were checked, and the operator recorded the outcome.

---

# Super short version (if time is short)

1. **Customer status** → Start new scenario → Pay by QR → Pay cash and get receipt → later bank debit → attach receipt → file complaint.
2. **Operator investigation** → Scan receipt → compare image regions with the preserved transcript.
3. Show **Receipt integrity check**: a real browser SHA-256 comparison; authenticity remains unverified.
4. Review fields → **Verify with Marketplace** → show DataDNA permission and source-comparison results.
5. Record verdict → Approve simulated refund → Post simulated refund → Customer status.

# One paragraph to memorize

> OpenCV helps the investigator inspect receipt regions. The receipt transcript is reviewed against the image, and the file fingerprint checks that the upload and scan refer to the same bytes. DataDNA limits the Marketplace request, and exact synthetic purchase and payment records establish whether an overpayment is corroborated. The operator approves an eligible outcome, and simulated refund completion is recorded separately.

# Present AI Investigation Studio separately

Open `/customer`, create a **Verified duplicate · repair ending** bank-to-upay transfer, run its stages, and save a Paid Twice complaint. Open that case from `/operations`, select **Local Qwen + guarded fallback**, and click **Analyze Case**.

> The Studio reconstructs transaction records, compares evidence, evaluates hypotheses, and prepares a cited next action. Multilingual E5-small embeddings with a trained logistic regression classifier provide advisory claim–passage readings. Rules remain primary. Optional local Qwen3:4b-instruct reviews the already-checked evidence packet and ranks predefined explanations. The run’s mode label shows whether Qwen actually returned an accepted assessment. Financial eligibility and execution remain controlled by backend rules and operator approval.

Show **Compare evidence**, a bank-posting citation, **Evidence & evolving hypotheses**, and the recommendation. For a current eligible case, **Approve cited repair** saves approval; **Execute Sandbox Repair** performs and verifies the simulated correction. Replay shows saved events without repeating model calls or financial actions.
