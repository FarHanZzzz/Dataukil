# DataUkil page narration scripts

Copy one narration block at a time into ElevenLabs. Page labels and production notes are not spoken.

**Suggested voice direction:** warm, clear, confident, and conversational. Use a steady pace, with a short pause between sentences. Keep the delivery reassuring when describing uncertainty. Every balance, account, payment, and repair shown in DataUkil is synthetic.

## 1. Homepage — `/`

One purchase. Every source in view.

DataUkil brings payment records, customer reports, and supporting evidence into one clear investigation. Follow a bank-to-wallet transfer, explore a QR and cash payment, or open the add-money walkthrough. See how an operator checks the facts, explains what is still unknown, and chooses a safe next step. This is a local demonstration using fictional accounts and simulated money. No real payment is made.

## 2. Customer dashboard — `/customer`

Welcome to the DataUkil customer dashboard. Start a fictional bank-to-upay transfer, choose a scenario, and watch each processing stage as it is recorded. If something looks wrong, report a stuck transfer or a possible duplicate payment. You can follow your case, review verified updates, share evidence, and message the assigned operator. The English and Bangla interface keeps each update clear. All balances and transfers in this demonstration are synthetic.

## 3. Operations center — `/operations`

This is the DataUkil operations center. The overview shows open cases, active investigations, evidence requests, eligible repairs, handoffs, and completed outcomes. Search or filter the inbox to find a case, then review its transaction, amount, current owner, and latest event. Select a case to inspect its payment path and saved evidence. These figures come from the local demonstration database, and every payment record is fictional.

## 4. Case workspace — `/operations/cases/{case_id}`

This case workspace brings the customer’s report and the payment records together. Follow the transaction from the customer through the gateway, bank, processing queue, settlement, and wallet. Each stage shows what the system has confirmed, what needs attention, and what remains unknown. Open a stage to inspect its saved events and source records. Customer statements are kept distinct from confirmed system records, so missing information is never treated as proof of failure or success.

## 5. AI Investigation Studio — `/operations/cases/{case_id}/studio`

Welcome to the AI Investigation Studio. The investigation works through saved records step by step: loading the case, reconstructing the transaction, comparing evidence, checking the customer’s claim, and assessing possible explanations. Select an event or citation to see the record behind a finding. Hypotheses can be supported, contradicted, or left unresolved. The AI can suggest what to review, but backend rules determine whether a repair is eligible. An operator must approve and separately execute any sandbox correction. Investigation progress alone does not mean the payment is resolved.

## 6. QR + cash investigation — `/qr-demo`

Follow one saved journey from the customer phone to the operator. Create a purchase and press Pay with QR. The screen shows failure or no confirmation, so the customer records cash and keeps the issued receipt. Later, bank activity shows a debit. Attach the receipt, review its transcript and file the complaint. The operator begins with a visual receipt scan. OpenCV highlights regions; it is not OCR or authentication. The synthetic Marketplace check compares the exact purchase, amounts and payment context. Matching records propose an operator-approved simulated refund. Rejection sends an explanation, and uncertainty pauses automation for an owned human review. Refund completion appears only after its separate saved event. No real money or external requests occur.

## 7. Add money walkthrough — `/mfs`

Follow a mobile wallet top-up through five guided stages. Choose a scenario, start the journey, review your amount and linked bank, then confirm the fictional request. The current action resumes the same payment or investigation in this tab. Transfer progress shows what the bank and wallet have recorded. If wallet credit remains unconfirmed, staff investigate the saved trace and either review an eligible correction or assign an owned follow-up. The final report distinguishes confirmed credit from pending follow-up. Use the companion view for a second demonstration tab. The walkthrough uses simulated partners and fictional Bangladeshi taka; it does not move real money.

## 8. Add-money customer page — `/customer/payment`

Choose an amount and a linked demonstration bank account. Review the destination wallet and the request details before submitting. The next screen follows the payment through its saved processing stages. If a result is delayed or uncertain, check the activity and status before trying again. You can report an issue on the same payment, then follow the case updates from the customer view. This is a synthetic demonstration; no real bank account or wallet is used.

## 9. Payment status and case tracking — `/customer/payment/{id}` and `/customer/cases/{id}`

This page shows the current status of one add-money request. Follow its processing timeline, read the next step, and see whether the wallet credit is confirmed or still uncertain. If you need help, report the issue on this payment so the investigator can review the same case. When a case is open, its owner, follow-up, and saved updates appear here. A pending confirmation is clearly shown as pending; it is not presented as a completed transfer.

## 10. Add-money investigator queue — `/admin/queue`

The investigator queue lists the saved add-money requests that need review. Select a payment to open its trace graph, inspect the processing stages, and run the permitted source checks. Each returned record is cited in the investigation. The findings update as evidence arrives, while missing or unavailable records remain visible as uncertainty. Review the proposed action and its requirements before deciding whether to approve it or hand the case off. This rules-based investigation does not use a language model to authorize repairs.

## 11. Add-money trace and report — `/admin/cases/{id}` and `/admin/cases/{id}/report`

The trace view explains what investigators checked and what each source returned. Open a graph stage or observation to inspect its details, then compare the evidence with the case hypotheses. If a correction is eligible, a separate approval and execution step records the result. If evidence is incomplete, the system keeps the outcome unresolved and assigns an owned next action. The report preserves the payment history, findings, citations, decision, and remaining questions for later review.

## Optional short closing line

DataUkil makes each payment easier to follow, each finding easier to verify, and each next step clear.
