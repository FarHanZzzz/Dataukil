# QR receipt workbench validation

Validated 4 October 2026 using isolated databases and real Chromium browser journeys. The receipt remains synthetic customer evidence; OpenCV is visual assistance, Marketplace records are local fixtures and no real money moves.

## Backend

```bash
.venv/bin/python -m pytest tests --ignore=tests/test_ml.py -q
```

**165 passed** (including **48 QR receipt/workflow tests**). The focused 48-test QR suite also passed after the compact purchase-summary and comparison-display updates. Coverage includes itemized baskets and tax, invalid quantities/prices/totals, original bytes/hash/download preservation, receipt attachment before complaint, three source outcomes, exact refundable excess, valid split tender, idempotency, owner-only review/approval, stale transcript/scan/review, archived pending proposals, owned handoff, customer privacy and image-free dossier provenance.

Visual-processing tests cover blank images with no invented boxes, template/generic semantic separation, perspective/EXIF geometry, invertible transforms, scaled previews, long 20-row wrapping, Bengali rendering, cropped/low-contrast inputs and immutable originals. Automated checks verify geometric bounds and round trips; they do not establish general receipt-recognition accuracy or authenticity.

The separate existing ML suite has **2 passed / 2 failed**. Its failures remain the dataset/split-manifest SHA mismatch and unavailable trained-model inference artifact (`torch` is missing in the current environment). This receipt implementation does not change training data, model artifacts or their dependencies.

## Browser

```bash
PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node scripts/check_qr_ui.mjs
```

**151 assertions passed**, with no browser runtime errors. Artifacts from the completed run: `/tmp/dataukil-qr-ui-gm8ncl`.

Checks cover:

- Compact default nine-row basket; editable item cards; integer poisha arithmetic; automatic/custom QR amounts; saved basket/tax drafts; valid split tender with no refund control.
- Same immutable receipt through issued preview, attachment, complaint and operator scan.
- Same-tab progression, exact simulation/case URLs, bookmarks, companion tab, refresh and Back/Forward.
- Actual scan beam/status, polling preserving mounted image canvas, aligned image/SVG dimensions, Original/Annotated switching, enlarged reader keyboard zoom and Escape.
- Explicit review acknowledgement before Marketplace checking; legitimate/rejected/uncertain branches; approval distinct from completion.
- Strong active edges, filled completed nodes, graph selection/zoom/replay and provenance.
- Receipt reader, QR workspace, evidence and activity at 320, 390, 768, 1024, 1440 and 1920px with no page overflow.
- Mobile step/navigation drawers, focus trapping/restoration, keyboard graph controls and reduced motion.

Receipt reveal frames and Replay scan are presentation only. They never create source checks, refunds or backend scan events.

## Add money and shared theme

```bash
PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node scripts/check_add_money_ui.mjs
PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node scripts/check_light_theme.mjs
PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node scripts/check_qr_board_preservation.mjs
```

- **192 Add money browser assertions passed**, including all four scenarios and all six widths.
- **86 shared light-theme assertions passed**.
- **1440px and 1920px Add money graph screenshots were byte-identical** against the existing baseline on the same fixture. QR workbench changes do not touch Add money graph assets.

Temporary browser databases and screenshots live outside the repository. Documentation of the additive APIs, manifest and source boundaries is in [QR + cash investigation](QR_CASH_INVESTIGATION.md).
