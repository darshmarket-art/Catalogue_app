# Responsive and adaptive UI: hand-off (updated 2026-10-24, session limit reached)

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
| extra | Buyer catalogue: swiping an open design loads more pages (was stuck at 24); the title under a photo opens the design. Test: `tests/e2e/catalogue-swipe.e2e.ts` | `8b45c4c` |

Baseline (414 combos, Edge 155): 0 overflow, 66 covered inputs, 1500 tap-target offenders, 2497 small-text, 136 clipped at 200%. Two combos unreachable (buyer tour at 844x390: profile menu cut off by the bottom nav).

## In flight (NOT committed, NOT merged): two worktrees under `Catalogue_app/.claude/worktrees/`

Both have uncommitted edits. Next session: `git -C <worktree> status` and `diff`, finish, run lint, test, build and the harness, commit, then merge into `feat/responsive-adaptive` with `git merge --no-ff`. Expect merge conflicts in `emergent.css` and `platform.css` (resolve by hand; Phase 1 owns widths and grids, Phase 2 owns units, fixed offsets and insets).
Do NOT run `git worktree remove` on a worktree before deleting any `node_modules` junction inside it: removing one wiped the main `node_modules` once (restored with `npm ci`).

### Agent A: Phase 1 layout (worktree `agent-abcf528b31d65a559`, branch `worktree-agent-abcf528b31d65a559`)
Brief: tablet tier 700-1023px (wider shell, 4-column grid, catalogue+detail and orders+order two-pane using `useTier()`), owner wide layout, landscape-safe `.em-feat` and `.em-hero.lg`, profile menu max-height at 844x390, landing page `platform.css` heights (`clamp()`/`svh`, `.hw-phone` aspect-ratio), QR sizes `min()` in `SignupScreen.tsx` and `StoreShareSheet.tsx`.
Uncommitted files so far: `AdminHubScreen.tsx`, `AdminOrdersScreen.tsx`, `ProfileMenu.tsx`, `SignupScreen.tsx`, `StoreShareSheet.tsx`, `platform.css`, `Catalogue.tsx`, `Orders.tsx`, `ProductDetail.tsx`, `emergent.css`, `useDesktop.ts`, `tests/e2e/README.md`. A new agent (restarted after an accidental stop) was continuing in this worktree.
Merge note: `Catalogue.tsx` and `ProductDetail.tsx` also changed in `8b45c4c` (swipe `position.of`, caption tap). Keep `position.total` = loaded count and `position.of` = full count.
Still to verify: phone sizes pixel-identical, tablet sizes 768x1024, 1024x768, 673x841, 344x882, live resize 673x841 to 344x882 with a product open and a scrolled grid, harness `RESPONSIVE_OUT=after-phase1`.

### Agent B: Phase 2 CSS/HTML (worktree `agent-a3f8cf5162caacfc2`, branch `worktree-agent-a3f8cf5162caacfc2`)
Brief: `100vh` to `100dvh` (vh line kept as fallback; `svh` for `.em-rail`), keyboard approach (pick `interactive-widget=resizes-content` or `visualViewport`; justify; plus scroll-padding so focused inputs clear `.em-savebar` and `.em-dock`, the root of the 66 covered inputs), `--sal`/`--sar` insets on `.em-fab`, `.em-tabs`, `.em-top-in`, `.em-page`, `.em-cartbar`, `.ax-nav` using `var(--sat)`, `viewport-fit=cover` plus padding for `console.html` and `public/offline.html`.
Uncommitted files so far: `public/offline.html`, `src/App.tsx`, `AdminCatalogueScreen.tsx`, `PhotoCropper.tsx`, `WelcomeGreeting.tsx`, `platform.css`, `console.css`, `gilded.css`, `index.css`, `emergent.css`, `src/main.tsx`, `tests/e2e/README.md`. Review `PhotoCropper.tsx` (already merged work from Phase 2 JS) and `main.tsx` changes carefully before merging.
Still to verify: covered inputs before (66) vs after, zero-inset pixel identity, throwaway inset test at 844x390, harness `RESPONSIVE_OUT=after-phase2`.

## Still to do (in this order)

1. Finish and merge A and B (above).
2. Phase 3 first pass (one agent, after A and B): touch targets (44px, hit area via padding or `::after`, check neighbours do not overlap): `.em-heart`, `.em-opts`, `.em-x`, `.em-qty.sm`, `.em-dots`, `.em-pd-dots`, `.em-chip`/`.chip`, `.em-link`, `.em-btn.sm`/`.btn.sm`, `.em-circ`/`.ib`; `height` to `min-height` on `.em-tabs nav`, `.em-chip`, `.em-srch`, `.inp`, `.em-top-in`; inputs 16px; gate the 10 `:hover` rules behind `@media (hover: hover)`; raise body text under 12px (badges may stay, say why). Hindi overflow list from the Phase 4 agent: Min/Max inputs, sort and filter chips, 3-column grid titles at 11px, `em-colcard-n`, `em-strip-i`, `em-col-ov`, "Resend in {n}s", "Verify and enter".
3. Phase 3 rem conversion, last: mechanical script over `emergent.css`, `index.css`, `platform.css`, `console.css`, `gilded.css` (px font sizes to rem, same size at default scale); diff review plus desktop screenshot comparison.
4. Phase 5.3 to 5.5 (lead): state survival across rotation and resize (cart, open product, sign-up form, OTP step, crop position, tour step, grid scroll); foldable live resize 673x841 and 344x882 (limitation: Capacitor has no fold-posture API); manual real-device checklist (sizes above, 200% font scale, keyboard on sign-up and OTP, rotation during crop and tour). The crop and tour verification steps are in the Phase 2 JS agent report (crop: fractions of the frame equal after resize 340x700 and 1200x800; tour: `data-step` unchanged, hole matches target within 2px).
5. Final table: finding, fixed / not fixed / could not verify, commit, evidence. Run `npm run lint`, `npm test`, `npm run build` and `test:responsive`; make the CI job required once green; verify the CI `responsive` job on a real runner (only run locally on Edge so far).

## Known facts and gotchas

- Playwright was NOT preinstalled (the brief was wrong): `@playwright/test` is now a devDependency; run locally with `PW_CHANNEL=msedge`; CI installs Chromium. Harness files are `*.e2e.ts` so vitest ignores them. Harness server lifts the rate limits (full runs exceed them).
- Run: `RESPONSIVE_SCRATCH="../scratchpad" RESPONSIVE_OUT=<name> RESPONSIVE_REPORT_ONLY=1 PW_CHANNEL=msedge npm run test:responsive` (about 5 minutes).
- `npm test` also picks up copies of tests inside `.claude/worktrees`; use `npx vitest run --exclude ".claude/**"` while worktrees exist. `tests/layout.test.ts` has a known timeout flake.
- Stale audit line numbers: `EntryScreen.tsx` hero is `:194` (not 103), `SignupScreen.tsx` `:385` (377), `PhotoViewer.tsx` `:349` (123), `BrandMark.tsx` `:35` (27); `<html lang>` was already set by `src/i18n.ts`; `BuyerTour.tsx:53` was partly stale.
- Open items found, not fixed: first paint is `lang="en"` for a Hindi user until JS runs; owner screens keep `lang="hi"` if the device saved Hindi; Android 12+ splash and keyboard on Android 7-10 need a real APK run (`antarixs-app.yml`); store logos that are opaque squares with content in the corners get clipped by round icon masks; owner catalogue (`AdminCatalogueScreen.tsx`) captions are not tappable like the buyer ones.
