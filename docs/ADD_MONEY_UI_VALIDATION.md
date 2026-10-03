# Add money UI validation

Validated locally on 3 October 2026 using Chrome with isolated SQLite databases and explicitly driven simulation clocks. These checks describe the local synthetic prototype.

| Check | Result |
|---|---|
| Transfer, workflow and integration regressions | 73 passed |
| Full existing Python suite | 119 passed; two existing ML failures described below |
| Browser acceptance runner | 192 assertions passed; no uncaught browser errors |
| Desktop board behavior | Graph module, topology, selection, camera, replay, citations, approval and exports pass the focused browser checks; workspace chrome intentionally refreshed |
| Responsive surfaces | Home, walkthrough, customer form/status, board and report checked at 320, 390, 768, 1024, 1440 and 1920px; no page overflow |
| Protected implementation | `static/pay/js/graph.js`, `static/pay/css/pay.css` and backend processing logic unchanged; product-name strings updated separately |
| Static checks | Changed JavaScript parses successfully; `git diff --check` passes |

A separate final homepage check also confirms Escape closes the Workspaces menu and returns focus, and that the expanded mobile header does not cover the hero content.

The landing-theme update passed 192 browser assertions, including all four financial endings and responsive checks at 320, 390, 768, 1024, 1440 and 1920px. Focused checks cover the prominent hero investigation link, clickable workspace preview, same-tab demo navigation and Back, exact selected-run demo context, and mobile scenario selection with a visible 48px-or-larger start action. Screenshots were reviewed across the walkthrough, form, status, report and refreshed investigation workspace. A tablet hero decoration that extended 16px past the viewport was repaired before the passing run. The board's graph behavior remains intact while its surrounding chrome intentionally follows the DataUkil landing theme. Financial success, processing, uncertainty and errors retain separate semantic treatments.

Final checks at all six widths verify 16px scenario descriptions, keyboard selection, visible mobile start controls, expanded desktop queue behavior, and no page overflow. Checked solid text/background pairs exceed 4.5:1 contrast; the scenario radio outline measures 4.60:1 against its inset surface. The chrome hero treatment is decorative display typography; forms, status messages and workspace controls use solid text colors.

After those comparisons, the product was renamed to **DataUkil**, including the board's existing brand label. The graph and board styling remain unchanged. Python module paths, settings, session protocols and saved financial references retain their existing identifiers.

The rename passed 29 page/export checks: nine page surfaces at 320, 390 and 1440px plus dossier and operations report exports. Browser titles and visible branding use DataUkil, brand links remain within the viewport, and no old product name or browser errors appeared. API documentation uses the new name and export hashes still match their contents.

The browser runner completes worker recovery with exactly one wallet credit, lost acknowledgement with no duplicate credit, blocked correction with an unconfirmed owned handoff, and late original completion with a superseded plan. The delayed scenario is checked at the decision stage before advancing to the original completion.

It also verifies explicit scenario selection, same-tab progression, companion and modifier tabs, exact-run resume, decision-stage return, unavailable and archived runs, fresh bookmarked form recovery, bank/amount draft restoration, review/edit, amount limits and decimal validation. A committed submission with a deliberately lost HTTP response survives refresh and retry without creating another payment. Live customer updates retain complaint text, focus and selection. A delayed report response cannot overwrite browser Back navigation.

Board checks cover node selection, inspector tabs, zoom, pan, citations, replay without new events, approval and Markdown/HTML downloads. Narrow screens expose Queue, Board, Details, Activity and secondary actions; keyboard checks cover modal focus trapping, Escape/return focus, arrow navigation between inspector tabs and menu focus restoration. All browser contexts use reduced motion. Reports retain table scrolling within the page and distinguish confirmed credit from unconfirmed follow-up.

The two full-suite failures are outside these UI changes: `test_groups_and_cases_disjoint_and_hashes_recorded` finds that the existing dataset bytes differ from the manifest checksum; `test_real_artifact_inference_and_explicit_token_abstention` cannot load the existing trained verifier because `torch` is absent from this environment. Dataset, model, training and backend files were not changed to suppress these failures.

Reproduce browser checks with:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright-core TRACEFIX_CHROME=/path/to/chrome TRACEFIX_KEEP_UI_ARTIFACTS=1 node scripts/check_add_money_ui.mjs
```

The script starts its own server on an available local port, records assertion results in a temporary directory and stops that server afterward. It does not use the normal runtime database. Desktop baseline images from this session are in `/tmp/tracefix-ui-audit-ip0y92ea/`.
