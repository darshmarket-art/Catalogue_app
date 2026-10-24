# Responsive test matrix (Playwright)

Opens every screen below at 13 phone/tablet/laptop sizes, at 100% and 200% font scale, screenshots it, and audits it. `npm test` (vitest) does not run it: the files are `*.e2e.ts`, which vitest does not match.

## Run it

Locally on this Windows box there is no downloaded Chromium, so use Edge:

```bash
PW_CHANNEL=msedge npm run test:responsive                       # everything (about 5 minutes, 4 workers)
PW_CHANNEL=msedge npx playwright test -g "390x844-200"          # one size and scale
PW_CHANNEL=msedge npx playwright test -g "owner-new-product"    # one screen, all sizes
```

CI (and any machine with the browser): `npx playwright install --with-deps chromium`, then `npm run test:responsive`.

The test starts its own server (`tests/e2e/server.ts`: real app, empty file store in the temp folder, demo catalogue, static sign-in code 123456, owner `owner@example.com`, platform mode so `/welcome-antarixs` and `/signup` work and a store opens at `/?store=bhakti`) on a free port, makes one buyer and the owner through the real API, and puts their tokens in `localStorage`.

| Env var | Effect |
| --- | --- |
| `PW_CHANNEL` | `msedge` / `chrome` to use an installed browser (default: Playwright's Chromium) |
| `PW_WORKERS` | parallel workers (default 4) |
| `RESPONSIVE_OUT` | phase folder: `before` (default), `after`, ... |
| `RESPONSIVE_SCRATCH` | where output goes (default `test-results/responsive`, git-ignored). For baselines use `.../catalogue-app/scratchpad` so nothing lands in the repo |
| `RESPONSIVE_REPORT_ONLY=1` | overflow and covered-input failures are recorded in `findings.json` instead of failing the test |
| `RESPONSIVE_STRICT_TARGETS=1` | tap-target offenders fail the test (default: listed only) |
| `RESPONSIVE_STRICT_TEXT=1` | small-text and clipped-text offenders fail the test (default: listed only) |

Output: `<RESPONSIVE_SCRATCH>/<RESPONSIVE_OUT>/<role>-<screen>-<W>x<H>-<scale>.png` for every combo, plus `findings.json` and a printed summary.

Baseline command used for the "before" numbers:

```bash
RESPONSIVE_SCRATCH="../scratchpad" RESPONSIVE_OUT=before RESPONSIVE_REPORT_ONLY=1 PW_CHANNEL=msedge npm run test:responsive
```

## What is checked

| Check | Rule | Fails by default |
| --- | --- | --- |
| Horizontal overflow | `scrollWidth <= width`. The test's width is used, not `innerWidth`, because a phone-emulating browser widens its layout viewport to fit an overflowing page. Also lists content that sticks out past the edge while the root hides it (`cutOff`). Offenders are the elements that break out of a fitting parent. | yes |
| Covered input | Each visible input/textarea/select is focused (the browser scrolls it into view), then a fixed or sticky element that does not contain it must not hold the point at its centre or cover half of it; it must also be on screen. An open menu or dialog is not a bar. Bars are judged after the focus: one that hides itself for the keyboard, or that sits underneath a modal layer holding the field, is not on top of anything. | yes |
| Tap target | Every visible `button, a, [role=button]` needs an effective box of at least 44x44 CSS px. The box is the element's border box (padding counts) widened to include absolutely positioned `::before`/`::after` boxes (computed from their resolved inset/size). Links inside a sentence are exempt and counted. Under 28 px on a side is flagged `severe`. | no |
| Small text | Computed font-size under 12 px on an element that owns text. | no |
| Clipped text (200% runs only) | `overflow` hidden/clip with `scrollWidth > clientWidth` or `scrollHeight > clientHeight`; `ellipsis` and `lineClamp` flags say if it is deliberate truncation. | no |

While a modal layer is open (tour, cart sheet, cropper, a design opened over the catalogue: a fixed element covering at least 90% of the screen) the page beneath is left out of the covered-input, tap-target and text checks.

`findings.json` has one section per check (`overflow`, `coveredInputs`, `tapTargets`, `smallText`, `clippedText`), each a flat list with `combo/role/screen/size/scale`, so a before and an after run can be diffed. Repeats on one screen (a card shown 20 times) are one entry with `count`. `combos` lists every combo with `status: ok | unreachable` and the reason.

### Where the thresholds come from (apple-design skill, `references/hig/`)

- 44x44 pass line, 28x28 floor: `accessibility.md`, "Mobility" > "Offer sufficiently sized controls" (iOS default 44x44, minimum 28x28).
- Text minimum: 12 px is the brief's rule; `accessibility.md`, "Vision" > "Use recommended defaults for custom type sizes" gives iOS 11 pt as Apple's minimum.
- Clipped text at 200%: `accessibility.md`, "Vision" > "Support larger text sizes" (enlarge text by at least 200 percent).
- Overflow and covered inputs: `layout.md`, "Adaptability" and "Guides and safe areas".

## Font scale is emulated

200% is `html{font-size:200%}`. That only moves text sized in rem/em. The app is mostly px, so at this stage 200% changes little (the platform pages, which use rem, do scale). Real Android WebView font scale also reaches only rem/em text; making the app rem-based is Phase 3, and this matrix is its baseline.

## Not emulated

- The on-screen keyboard itself: no IME, no `interactive-widget`, no Chrome visual-viewport-only resize, no iOS. `keyboard.e2e.ts` does what the Android app does (adjustResize): it makes the window shorter after the screen is open (phone and landscape phone, with the keyboard up) and focuses every field of the phone and code steps, sign-up, admin login, the new-product form and the order note; none may sit under a bar or outside the window. It also checks that the bars step aside while a field has focus (`html[data-typing]`) and come back.
- Safe-area insets / notch (`env(safe-area-inset-*)` is 0). The same file forces `--sal`/`--sar` to 44 px on `:root` at 844x390 and checks that header, tabs, buttons and page content stay out of the 44 px strips.
- Real Android font scale and Capacitor.

## Add a screen

In `screens.ts` add an entry to `SCREENS`: `{ id, role: 'buyer' | 'owner' | 'guest', open: async (page) => { ... } }`. `open` goes to the screen with real clicks and waits for something that only exists there (prefer `getByTestId`). Roles decide what is in `localStorage` before the app starts (`seedRole`). It runs at every size and scale automatically. If a screen cannot be reached yet, add `fixme: 'why'` and it is skipped with that reason. If it fails only at some sizes, the combo is recorded as `unreachable` (a screenshot `...-UNREACHABLE.png` is saved) and that is a finding.

Sign-in rate limits are lifted in `server.ts`; without that, a full run exhausts the server's 1000-calls-per-15-minutes limit and sessions start failing half way.
