# Responsive and adaptive UI: hand-off (updated 2026-10-24, session limit reached; Phases 1 and 2 merged)

Read `docs/PROJECT_STATE.md` first, then this. Branch: `feat/responsive-adaptive` (never push to main, no PR until asked). Commits carry `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
Skills the user wants used for UI work: `.claude/skills/apple-design` and `.claude/skills/apple-motion` (outside the repo, in `catalogue-app/.claude/skills`). Cite the skill rule that drove each decision.
Scratchpad (screenshots, findings, outside the repo): `C:\Users\darshan.parekh\Desktop\Gold app\catalogue-app\scratchpad\` (`before\findings.json` is the baseline; `after-phase1\`, `after-phase2\` are partial runs).

## Done and merged into `feat/responsive-adaptive`

| Phase | What | Commit |
| --- | --- | --- |
| 0 | Playwright harness `tests/e2e/`, `npm run test:responsive`, CI job `responsive` (continue-on-error), BEFORE baseline | merge `d9079dc` |
| 2 (JS) | `PhotoCropper` frame re-measures and keeps the crop on rotation; `BuyerTour` measured heights and keeps its step; `useTier()`/`useTablet()` in `useDesktop.ts` (`TABLET_MIN` 700, `DESKTOP_MIN` 1024) | merge `708b98f` |
| 4 | `srcset`/`sizes` from the existing `/media?w=` variants, lazy and async decoding, platform JPEGs -29.5%, `lang` already handled by `i18n.ts` | merge `e3fc4fc` |
| 5.1, 5.2 | Android shell patches in `scripts/storeApp.ts` (`adjustResize`, `EdgeToEdge.enable`, themed splash), `SystemBars` config, adaptive icon inside the safe zone | merge `f4e1ef0` |
| 2 (CSS/HTML) | dvh/svh, typing signal and scroll padding for the keyboard, `--sal`/`--sar`, offline.html cover (see Agent B below) | merge of `1934cdd` |
| 1 | Tablet tier, two-pane, owner wide layout, landscape, landing, QR (see below) | merge `6d388a9` |
| extra | Buyer catalogue: swiping an open design loads more pages (was stuck at 24); the title under a photo opens the design. Test: `tests/e2e/catalogue-swipe.e2e.ts` | `8b45c4c` |

Baseline (414 combos, Edge 155): 0 overflow, 66 covered inputs, 1500 tap-target offenders, 2497 small-text, 136 clipped at 200%. Two combos unreachable (buyer tour at 844x390: profile menu cut off by the bottom nav).

## Phase 1 layout: DONE and MERGED (agent commit `209549c`, merge `6d388a9`)
Tablet tier 700-1023px (shell 880px, tab bar 720px, 4-column grid, 5 in compact), catalogue+detail two-pane (`usePane()`, `PANE_MIN_H=560` in `useDesktop.ts`, must match the min-height media query in `emergent.css`), orders two-pane, owner wide layout (880px tablet, 1040px desktop, hub tiles 4 across, orders as card grid), landscape heroes in svh, profile menu max-height (the 844x390 tour combos are reachable now), landing banner `clamp(380px,90svh,900px)`, `.hw-phone` aspect-ratio, QR `min(clamp(180px,36vw,280px), max(180px,38svh))` with a 640px raster. New `tests/e2e/tablet.e2e.ts`.
Merge check: after the merge, lint, 360 unit tests, build and the full harness (446 passed, overflow 0, covered inputs 0) are green; tap targets 1517, small text 2512, clipped 136 (Phase 3 baseline).
NOT done by that agent: it did not read the skill files or cite rules, and did not re-check the audit line numbers. Phone pixel diff (320-430): 38 of 80 differ, looked like noise and random data in the two pairs viewed; not every pair checked. Buyer at >=1024px was not diffed (should be unchanged; unproven). Live resize 673 to 344 to 1024: the open product survived every step, scroll position moved with reflow (never jumped to top). `buyer-cart-sheet` and `buyer-product-detail` at 1024x1366 timed out once under load, pass alone.
Worktree `agent-abcf528b31d65a559` can be left alone (do not remove it before checking for a node_modules junction).

### Agent B: Phase 2 CSS/HTML: DONE and MERGED (agent commit `1934cdd`, merged into feat/responsive-adaptive)
Keyboard approach: a focus signal (`html[data-typing]`, set in `src/main.tsx` on touch screens under 1024px) fades the tabs, cart bar, FAB and dock; the save bar rests in flow; bars return 200ms after blur. Plus measured `scroll-padding` and a manual `scrollIntoView` (Chromium ignores `scroll-margin` on text fields). Not `interactive-widget` (iOS ignores it, the Android app already resizes) and not `visualViewport` (both shrink together in the app).
Results: covered inputs 66 to 0, overflow 0, unreachable still 2 (buyer tour at 844x390, Phase 1 owns it). Every `vh` has a dvh/svh partner (`tests/viewportUnits.test.ts` guards it). `--sal`/`--sar` applied; `.ax-nav` uses `var(--sat)`; `offline.html` has viewport-fit=cover and padding; `console.html` deliberately left alone (owner dashboard, not in the app). `PhotoCropper.tsx` dialog now scrolls in landscape (Use photo was cut off). New `tests/e2e/keyboard.e2e.ts` (23 tests).
Could not verify: pixel identity at zero insets (208 of 414 screenshots differ, mostly under 0.5% noise; pairs in scratchpad `head-ref` vs `after-phase2`); real keyboard on Android app, Chrome Android and iOS; cut-out hardware; tapping Save during the 200ms release. Deliberate departure from `tab-bars.md` (tab bar hidden while typing). Stale lines: `.em-rail` is now ~541 (already svh); SignupScreen uses `minHeight: '100dvh'` at :188, not svh; `App.tsx` min-h-screen was at 797/807.
Hard-coded in `main.tsx`: the 1024px breakpoint and the list of bar classes (the 1024 value is also in `emergent.css`).
Do not remove its worktree before deleting `node_modules` inside it (a real directory from `npm ci`, not a junction).

## Still to do (in this order)

1. (Done: Phases 1 and 2 are merged.) Optional: diff buyer at >=1024px before/after Phase 1 to prove it is unchanged, and check phone pairs at 320-430.
2. (DONE on branch worktree-agent-a275e1c15f2fef8d7, Phase 3a: touch targets, min-height, 16px fields, hover gating, 12px text floor, Hindi at 320; harness numbers in its commit message; not yet merged) Phase 3 first pass (one agent, after A and B): touch targets (44px, hit area via padding or `::after`, check neighbours do not overlap): `.em-heart`, `.em-opts`, `.em-x`, `.em-qty.sm`, `.em-dots`, `.em-pd-dots`, `.em-chip`/`.chip`, `.em-link`, `.em-btn.sm`/`.btn.sm`, `.em-circ`/`.ib`; `height` to `min-height` on `.em-tabs nav`, `.em-chip`, `.em-srch`, `.inp`, `.em-top-in`; inputs 16px; gate the 10 `:hover` rules behind `@media (hover: hover)`; raise body text under 12px (badges may stay, say why). Hindi overflow list from the Phase 4 agent: Min/Max inputs, sort and filter chips, 3-column grid titles at 11px, `em-colcard-n`, `em-strip-i`, `em-col-ov`, "Resend in {n}s", "Verify and enter".
3. Phase 3 rem conversion, last: mechanical script over `emergent.css`, `index.css`, `platform.css`, `console.css`, `gilded.css` (px font sizes to rem, same size at default scale); diff review plus desktop screenshot comparison.
4. Phase 5.3 to 5.5 (lead): state survival across rotation and resize (cart, open product, sign-up form, OTP step, crop position, tour step, grid scroll); foldable live resize 673x841 and 344x882 (limitation: Capacitor has no fold-posture API); manual real-device checklist (sizes above, 200% font scale, keyboard on sign-up and OTP, rotation during crop and tour). The crop and tour verification steps are in the Phase 2 JS agent report (crop: fractions of the frame equal after resize 340x700 and 1200x800; tour: `data-step` unchanged, hole matches target within 2px).
5. Final table: finding, fixed / not fixed / could not verify, commit, evidence. Run `npm run lint`, `npm test`, `npm run build` and `test:responsive`; make the CI job required once green; verify the CI `responsive` job on a real runner (only run locally on Edge so far).

## Known facts and gotchas

- Playwright was NOT preinstalled (the brief was wrong): `@playwright/test` is now a devDependency; run locally with `PW_CHANNEL=msedge`; CI installs Chromium. Harness files are `*.e2e.ts` so vitest ignores them. Harness server lifts the rate limits (full runs exceed them).
- Run: `RESPONSIVE_SCRATCH="../scratchpad" RESPONSIVE_OUT=<name> RESPONSIVE_REPORT_ONLY=1 PW_CHANNEL=msedge npm run test:responsive` (about 5 minutes).
- `npm test` also picks up copies of tests inside `.claude/worktrees`; use `npx vitest run --exclude ".claude/**"` while worktrees exist. `tests/layout.test.ts` has a known timeout flake.
- Stale audit line numbers: `EntryScreen.tsx` hero is `:194` (not 103), `SignupScreen.tsx` `:385` (377), `PhotoViewer.tsx` `:349` (123), `BrandMark.tsx` `:35` (27); `<html lang>` was already set by `src/i18n.ts`; `BuyerTour.tsx:53` was partly stale.
- Open items found, not fixed: first paint is `lang="en"` for a Hindi user until JS runs; owner screens keep `lang="hi"` if the device saved Hindi; Android 12+ splash and keyboard on Android 7-10 need a real APK run (`antarixs-app.yml`); store logos that are opaque squares with content in the corners get clipped by round icon masks; owner catalogue (`AdminCatalogueScreen.tsx`) captions are not tappable like the buyer ones.
