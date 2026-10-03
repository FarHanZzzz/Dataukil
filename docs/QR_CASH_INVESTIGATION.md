# QR + cash investigation

`/qr-demo` is the canonical DataUkil customer-to-operator journey. The homepage links to it directly. The earlier hard-coded homepage story is replaced by a link to the same saved experience.

## Guided journey

1. **Purchase:** enter the merchant, item, invoice and QR amount. Start a new scenario or explicitly resume a saved journey. Presenter source choices live in expandable setup details.
2. **QR attempt:** the customer phone displays a synthetic QR and a Pay action. It then shows failure / no confirmation. The phone result is separate from the eventual bank record.
3. **Cash and receipt:** record cash and receive a purchase-specific watermarked receipt. This is a customer report of cash, not bank or merchant source authority.
4. **Later bank activity:** explicitly observe the original QR debit. This customer observation remains separate from the independently checked synthetic bank record.
5. **Evidence and complaint:** use the generated sample or upload a PNG/JPEG, review its transcript and attach it before filing. The complaint atomically promotes the exact cited receipt artifact.
6. **First-line operator scan:** open the linked case. Scan receipt is the first primary action. The original and derived preview appear together; a beam travels down the page and region boxes appear with field announcements. Reduced motion uses instant staged reveals.
7. **Marketplace:** after scanning, explicitly query bounded synthetic records for the exact purchase. The board highlights the outbound query, returned order, amount/item, QR, bank and cash comparisons.
8. **Verdict:** record the saved source result. Unavailable data cannot be rejected. A receipt/transcript/OpenCV preview cannot independently grant financial authority.
9. **Resolution:** legitimate evidence proposes a refund; the current operator owner approves the request and separately posts the synthetic completed refund. Rejection records an explanation with no refund. Uncertainty pauses automation and saves an owner, receiving queue, missing evidence and next review.

No real money moves and no external Marketplace request occurs. Customer status keeps QR screen, reported cash, observed debit, receipt, verdict and refund completion separate.

## Context and navigation

Bookmarks use `/qr-demo?simulation=<id>&case=<id>&view=customer|operator|both`. Unknown IDs and mismatched simulation/case pairs show recovery instead of selecting another record. Fresh visits show Start new scenario and, when available, Resume saved journey. Browser history changes only the local workspace view/selection; it does not repeat mutations. Shortcuts use the same tab. Open companion view is an explicit new-tab link carrying the same IDs. Modifier clicks retain browser behavior.

The persistent rail and current-stage banner show the journey. On small screens Customer, Evidence, Marketplace and Outcome are available from a native modal navigation drawer. View all steps opens the complete rail. Native dialog focus trapping, Escape, visible focus, status announcements and reduced motion are supported.

## Evidence contract

`POST /api/simulations/{id}/receipt` accepts multipart fields `file`, `transcript`, and current `version`, plus `Idempotency-Key`. Images are PNG/JPEG, at most 2 MiB and 12 megapixels, with both dimensions at least 100px. MIME type must match actual bytes. The transcript is required and at most 4,000 characters.

The persisted draft contains a generated `receipt_evidence_id`, simulation association, immutable bytes, MIME, SHA-256, transcript, actor and timestamp. Superseded drafts remain in the simulation archive. Identical operation retries return the original response; changed content under the same key returns 409. A new upload requires the current simulation version.

`POST /api/simulations/{id}/complaint` takes current `version`, description and `receipt_evidence_id`. It promotes that exact owned draft atomically. JSON complaint compatibility is retained for older walkthroughs, as is `POST /api/cases/{id}/upload` for additional evidence. Files remain unverified customer assertions. `/api/evidence/{id}/file` returns the immutable original under role and ownership checks.

The sample contains merchant, item, purchase ID, amount, cash reference, timestamp and the watermark **Synthetic DataUkil Demo**. Values displayed during scanning come from the preserved transcript through a deterministic field parser. They are not extracted by OCR.

## OpenCV visual assistance

`opencv-python-headless==4.10.0.84` is pinned. `tracefix/qr_receipt.py` validates and decodes the original, grayscales, normalizes, thresholds, finds the paper contour, corrects perspective and detects visual text regions. It saves a separate annotated image without modifying the input.

The manifest contains source evidence ID, input hash, engine/version, scan status, image dimensions, field bounding boxes, displayed values, value sources, advisory confidence, warnings, processing steps, timestamp and evidence version. Regions needing review are explicitly labelled. This is visual assistance, not OCR, receipt authentication or proof that cash moved.

## Synthetic sources and operator actions

The purchase creates a private exact-context Marketplace fixture. Existing `confirmed`, `denied`, `unverified` and `qr_failed` source profiles remain available. Checks compare purchase, merchant, item, invoice/receipt amounts, cash, QR and bank references, timestamp, independent debit/cash confirmation and previous refund state.

`POST /api/cases/{id}/check` accepts `kind: receipt_scan|marketplace`, current case `version` and `evidence_version`, plus an idempotency key. Only the current staff owner advances the QR pipeline. Marketplace checking requires the current receipt scan. Repeated current scans preserve the saved artifact/event history.

`POST /api/cases/{id}/qr-action` accepts `action: verdict|approve_refund|complete_refund|handoff`, current case and evidence versions, and an idempotency key. Verdict requests also carry `verdict: LEGITIMATE|REJECTED|UNCERTAIN`; they must follow the saved Marketplace result. Mutations atomically save their state, actor, audit, timestamp, source identifiers, evidence citations, append-only QR events and retry response.

| Branch | Saved behavior |
| --- | --- |
| Legitimate | Matching context → eligibility/proposal → operator approval/request → separately saved completed refund → customer notification |
| Rejected | Explicit source denial or conflicting receipt/context → saved reason → customer notification; no refund |
| Uncertain | Source unavailable, incomplete fields, source conflict, timeout or previous refund ambiguity → pause → human handoff; no new refund |

Evidence changes invalidate the scan, check and verdict. A changed Marketplace result also invalidates the verdict. Stale approvals cannot be executed. Prior completed refunds remain historical facts and block another credit. Handoff retains the current owner until the receiving investigator accepts through the existing acknowledgement control.

Customer projections include only safe verdict, resolution and handoff fields. They omit raw comparisons, fixture profiles, source catalogs, scan confidence, internal evidence, audit and QR event history.

## QR board and exports

`static/legacy/qr-graph.js` defines a separate Evidence → Marketplace → Payments → Decision → Resolution topology and pure append-only reducer. Unknown remains unknown until a saved event exists. Replay changes the view, never the backend. Selection exposes event provenance and evidence citations; fit, zoom and pan are local camera controls.

QR active edges use 4px blue strokes, glow, directional arrows and animated dashes. Completed nodes have a full blue tinted surface, a check and readable status. Conflicts are red, uncertainty amber and human handoff violet. Reduced motion removes probes while retaining the thick active edge. The subsequent site-wide light-theme request applies white and pale surfaces to both customer and operator panels through `static/light-theme.css`.

The dossier export includes original hashes, transcript revisions, scan metadata, Marketplace results, verdict/resolution/handoff and saved QR events. Preview base64 is excluded from the Markdown export.

The Add money graph module, topology, camera, toolbar and replay remain intact. Its palette now follows the requested site-wide light theme. Citation navigation also repaints Evidence when the cited node is already selected. QR variant styles are isolated under `.qr-workspace` and `.graph--qr`; the shared daylight stylesheet applies the current website theme.

## Verification

Backend coverage is in `tests/test_qr_workflow.py`; browser coverage and screenshots are produced by `scripts/check_qr_ui.mjs`. See [QR validation](QR_UI_VALIDATION.md). Existing workflow, simulation, integration and transfer suites and the Add money browser suite are included in regression checks.
