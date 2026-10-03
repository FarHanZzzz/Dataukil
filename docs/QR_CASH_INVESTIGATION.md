# QR + cash investigation and receipt workbench

`/qr-demo` is the canonical DataUkil customer-to-operator journey. The homepage links directly to this saved experience. All records are synthetic; no real money moves or external Marketplace requests occur.

## Guided journey

1. **Purchase:** start a new scenario or explicitly resume a saved purchase. The compact basket opens into editable item cards; merchant, address, tax and QR amount are separate. The default FreshMart Demo basket has nine items totaling BDT 500.00 and zero tax. Prices are synthetic. Presenter-only source profiles remain expandable.
2. **QR attempt:** the phone displays a synthetic QR and Pay action, then failure/no confirmation. This screen result does not establish the bank posting result.
3. **Cash and receipt:** save cash paid and issue a realistic purchase-specific paper receipt. Invoice total and cash paid appear independently. Receipt issue time, original PNG, SHA-256, transcript and measured template layout are saved once.
4. **Later activity:** the customer observes the original QR debit. This remains a customer observation until an independent synthetic source check.
5. **Complaint evidence:** attach the already-issued sample or another PNG/JPEG, then cite that exact receipt draft when filing the complaint. No receipt is regenerated during attachment.
6. **Scan:** the operator opens directly to receipt evidence. Scan receipt performs actual OpenCV processing, then reveals saved regions top-to-bottom for approximately six seconds. Skip and Replay scan are presentation-only. Reduced motion displays saved findings immediately.
7. **Review:** inspect Original, Processed or Annotated; zoom, enlarge, download and select field regions. Acknowledge missing fields and add a review note. Values come from the preserved transcript, not OpenCV text recognition.
8. **Marketplace:** Verify with Marketplace first saves the current field review, then checks exact-context synthetic order and payment records. The QR board shows the query, returned order, itemization, QR, bank and cash checks.
9. **Verdict/resolution:** a corroborated overpayment proposes its exact refundable excess. The owner approves a request and separately posts a synthetic completion. Rejection records an explanation without refund. Uncertainty pauses automation and saves an owned human handoff and next review.

The customer sees QR screen result, cash report, observed debit, receipt, verdict and refund completion as separate facts. A receipt, template recognition or OpenCV result never confers source authority.

## Navigation and reader

URLs retain `/qr-demo?simulation=<id>&case=<id>&view=customer|operator|both`. Unknown IDs and mismatched associations show recovery rather than silently selecting another record. Fresh visits offer Start new scenario and an explicit saved-journey resume. Default links use the same tab; Open companion view preserves exact context in a second tab. Back/Forward and refresh do not repeat mutations.

Stage banners and receipt toolbars stay in normal document flow. Mobile navigation and View all steps retain their accessible modal drawers. Customer View receipt and operator View larger open a native dialog with focus trapping, Escape, restored trigger focus and keyboard `+`, `-`, `0` zoom.

The reader uses a clean image plus an SVG in the same preview coordinates. Zoomed-image scrolling stays inside the reader. The mounted evidence task, scan status, beam, zoom, scroll and review controls survive polling during the reveal. Evidence changes select a new reader key and invalidate the old presentation. Replay scan creates no events or source checks.

## Purchase contract

`POST /api/simulations` accepts existing `customer_name`, `merchant`, `qr_amount_minor` and profile fields plus:

```json
{
  "merchant_address": "Dhaka, Bangladesh",
  "line_items": [{"description": "Rice, 1 kg", "quantity": 2, "unit_price_minor": 8000}],
  "tax_minor": 0
}
```

Amounts are integer poisha. Support 1–20 rows, descriptions up to 80 characters, integer quantities 1–99, positive unit prices and nonnegative tax. The server computes line totals, subtotal and invoice total using the existing BDT 1,000,000 total bound. A supplied inconsistent total is rejected. Legacy `item`/`total_minor` requests become one quantity-one row with zero tax. Old saved records retain their original bytes and remain readable.

The QR amount follows basket edits until explicitly customized; a customized amount is preserved and cannot exceed the invoice. Basket, tax and QR drafts survive refresh without submission. No VAT rate is inferred from the visual US receipt reference.

## Immutable evidence contract

`POST /api/simulations/{id}/receipt` retains multipart `file`, `transcript`, current `version` and `Idempotency-Key`. Images must be PNG/JPEG, at most 2 MiB and 12 megapixels, with both dimensions at least 100px. Actual bytes must match MIME type. Transcript text is required and bounded to 4,000 characters.

Drafts retain their exact simulation association, original bytes, MIME, hash, transcript, actor and timestamp. Superseded drafts remain saved. An identical operation retry returns its original response; changed content under the same key returns 409. `POST /api/simulations/{id}/complaint` promotes the exact owned `receipt_evidence_id` atomically. Existing JSON complaints and additional post-complaint uploads remain supported.

`/api/evidence/{id}/file` downloads the unchanged original under role/ownership checks. The case artifact, draft, customer preview, operator original and downloaded file must have the same hash.

The supplied receipt image is a **layout reference**, recreated as a fictional BDT receipt. The default renderer uses bundled DejaVu receipt fonts and Noto Bengali fallback, centered merchant/address/date, item and price columns, dashed separators, subtotal/tax, large total, cash details, decorative barcode and a quiet Synthetic DataUkil Demo footer. Text is measured/wrapped and receipt height grows with its items. The illustrative barcode is not decoded and conveys no authenticated identifier.

Generated item transcripts use compact JSON rows, e.g. `Item 1: ["Rice, 1 kg",2,8000,16000]`; structured objects are also accepted by the parser. These are preserved supplied values, not source records. Legacy Merchant/Purchase/Item/Amount/Cash reference/Timestamp colon labels remain readable. Genuine receipts may omit identifiers; the reviewer must acknowledge omissions rather than invent them.

## OpenCV manifest version 2

Keep `opencv-python-headless==4.10.0.84`. Processing validates bytes, normalizes EXIF orientation, detects convex paper candidates using area/solidity/edge support, preserves paper proportions during perspective correction, normalizes illumination, thresholds printing and groups connected components into text/column regions. Separator and barcode candidates remain visual classifications. Missing paper contours retain the original alignment with a warning; blank images produce no invented boxes.

The manifest saves:

- Scan ID/version, evidence ID/version, transcript revision, original hash, engine/version, timestamp and warnings.
- Original/oriented/rectified/preview dimensions, paper quadrilateral, orientation/perspective/preview transforms and inverses.
- Stable visual region IDs, actual preview bounding boxes, corresponding original polygons, region kind and measured ink coverage.
- Field associations, displayed transcript values, value source, semantic-label source and review requirements.
- Independent clean and annotated preview bytes, dimensions and SHA-256 hashes.

Ink coverage is a geometric diagnostic, not calibrated authenticity confidence. Semantic labels are associated automatically only when the original hash matches the server-saved fixture for this exact simulation and its measured template. Other uploads remain generic until operator mapping. A recognized fixture still supplies no financial authority.

Keep legacy manifests readable. Pending legacy cases require an explicit updated scan and review before new Marketplace decisions. Completed refunds remain historical and cannot be rescanned into another financial outcome.

## Saved field review

`POST /api/cases/{id}/qr-action` adds `action: review_receipt`, with current case/evidence versions, exact `scan_id`, `field_regions`, `reviewed_fields`, `missing_fields`, reason and idempotency header. Every mapped region must belong to that scan; every relevant field must be reviewed or explicitly marked missing. Only the current owner can save it.

The saved review contains an ID, actor, time, reason, scan/evidence/transcript versions and field-to-region mapping. It appends `RECEIPT_REVIEW_SAVED`. Selectors support multiple regions and synchronize visual highlights; no freehand boxes are fabricated. Verify with Marketplace remains disabled until acknowledgement and a review note are present. A network failure preserves the review and permits retry.

The existing `/correct` operation remains the wording-correction endpoint. QR corrections require the owner and current evidence version, create a transcript revision and invalidate scan/review/check/verdict freshness. Changed review mappings also invalidate source checks and verdicts. Pending refund proposals/requests are archived as stale, permitting a new grounded verdict; completed refunds are preserved.

## Independent synthetic checks and refund math

A private order snapshot is saved at purchase creation; receipt/transcript edits cannot alter it. A profile-controlled merchant cash record is saved at the cash event. Source profiles remain confirmed, denied, unverified and qr_failed.

`POST /api/cases/{id}/check` keeps `kind: receipt_scan|marketplace`, current case/evidence versions and idempotency. Marketplace requires a current version-2 scan and saved review. Checks compare purchase, merchant, currency, item descriptions/quantities/prices, subtotal, tax, total, cash paid/method/reference, receipt timestamp, linked QR/bank references, posted amount and prior refunds. Linked references are not pretended to be printed receipt fields.

```text
verified excess = posted QR + independently confirmed cash − invoice total
```

| Verified situation | Result |
| --- | --- |
| Positive excess no greater than posted QR | LEGITIMATE; propose exactly that excess |
| No excess, including a valid split tender | REJECTED duplicate claim, reason NO_OVERPAYMENT; the receipt may still be valid |
| Excess above QR debit | UNCERTAIN; additional cash reconciliation |
| Explicit source denial, mismatched currency/merchant/items/amount/reference | REJECTED with recorded reason |
| Missing fields, unavailable/ambiguous/conflicting sources or prior refund ambiguity | UNCERTAIN; no new refund |

Existing verdict/approve_refund/complete_refund/handoff actions remain. Customer actions never refund money. Approval is distinct from completion; no refund appears completed before its synthetic event is saved. Handoff retains ownership until receiving acceptance and records queue, missing evidence and next review.

Customer projections hide source catalogs, profiles, raw comparisons, scan/review metadata, internal notes and QR event history. Completed refund facts remain visible even when later evidence requires additional review.

## Graph, exports and boundaries

The QR-specific topology, renderer and append-only reducer remain in place. Active glowing edges, filled completed nodes, verdict colors and graph replay continue to use saved events. Receipt reveal frames create no backend events.

Dossiers retain original hashes, revisions, scan/review geometry, source checks, eligibility arithmetic, verdicts, historical resolutions and QR events, stripping image payloads from all manifests/history. Original and annotated preview downloads are separately named.

All reader styles are QR-scoped. The Add money graph assets, topology, camera behavior and controls remain unchanged. See [receipt validation](QR_UI_VALIDATION.md).
