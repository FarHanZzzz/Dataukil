# DataUkil light theme validation

Validated on 4 October 2026 using isolated SQLite fixtures and Chromium.

The supplied landscape is used unchanged as `/static/img/hero-landscape.png`. Its original dimensions are 1024 × 577; its SHA-256 is `52cf497044d2c59161c3bc0c190e1b5ff3d31473187d262f57b46039f942ef0e`. Responsive cropping and a white reading overlay are CSS effects, not changes to the image bytes.

All six HTML entry documents load `static/light-theme.css`. The homepage, Add money setup, customer form/status, investigation board/report, QR workspace, customer dashboard, operations center and AI Studio use white surfaces, slate text, blue actions and consistent typography. Cyan identifies active information; green, amber, red and violet distinguish completion, uncertainty, errors and human handoff. Status labels remain explicit. The old dark homepage WebGL background is inactive in light mode.

| Check | Observed result |
| --- | --- |
| Site-wide browser checks | 86 assertions passed across ten page types |
| Responsive widths | 320, 390, 768, 1024, 1440 and 1920px; no page overflow |
| Theme coverage | Light documents and native controls; no remaining large dark panels on the inspected pages |
| Hero | Supplied original image loads; dark WebGL backdrop remains inactive |
| Contrast | Primary and hovered primary action text meet 4.5:1 |
| Browser errors | None observed during the site-wide check |
| QR journeys | 112 browser assertions passed, including all three outcomes, navigation, receipt scan and Marketplace animation |
| Add money journeys | 192 browser assertions passed across four scenarios and six widths |
| Protected board | Existing and current graph screenshots are byte-identical at 1440px and 1920px when both receive the same new light palette |
| Backend regression | 141 non-ML tests passed |

The latest user request intentionally changes the Add money board palette. Its topology, graph module, camera and financial behavior remain unchanged. The board comparison uses baseline commit `0ae097a` with the current shared light stylesheet applied to both versions. It validates preservation of the graph under the new palette, rather than preservation of the previous dark colors.

The full Python suite has two pre-existing ML failures, documented in [QR_UI_VALIDATION.md](QR_UI_VALIDATION.md). The trained verifier is not required by the new OpenCV receipt and synthetic Marketplace workflow.

Reproduce:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright TRACEFIX_CHROME=/path/to/chrome node scripts/check_light_theme.mjs
PLAYWRIGHT_MODULE=/path/to/playwright TRACEFIX_CHROME=/path/to/chrome node scripts/check_qr_board_preservation.mjs
```

Each runner starts and stops its own server with an isolated database. The recorded site-wide results and representative screenshots are in [artifacts/ui/light-theme](../artifacts/ui/light-theme/). Full local screenshots were saved in `/tmp/dataukil-daylight-XFKS3V`; the board comparison is in `/tmp/dataukil-board-baseline-ywYS74`.
