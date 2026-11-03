# Next session: what is done, what is running, what to do

Written 2026-11-03 at the end of a long session. Repo: `catalogue-app/Catalogue_app`, branch `feat/responsive-adaptive` (= `origin/main` at `cee961f`). The live Cloud Run service is `catalogue-app`, asia-south1, project `gen-lang-client-0273003651`.

## 1. State of main (pushed and live after the Cloud Build)

- **Maison layout** (Bulgari-inspired, opt-in per store in Store settings: Classic / Maison). Classic (Emergent) is the default and was pixel-identical in QA rounds 1 to 3.
  - Buyer side in `src/layouts/maison/**`: header with 3-bar tag index (collection names, no counts), profile panel, home, portrait 1:2 cards (`--mx-tile-ratio`), shortlist, orders, placed-order animation, plain fade transition (`--mx-xition-*` tokens), colour tokens `--mx-*` with presets `data-mx-theme` (midnight, garnet).
  - Owner side in `src/layouts/maison/owner/**`: shell (sidebar and bottom bar), charts (Today, Insights, Visitors, Orders), content skins. Owner bottom bar is shown on every owner screen.
- **AI render**: new uploads (Add design, Add collection) and "AI Enhance" on existing photos. 8 styles with a style picker (cad, silk, studio-dark, editorial, giftbox, festive, on-model, macro); on-model placement derives from the collection tag. Originals are never deleted. Server: `server/aiRender.ts`, `server/routes/photos.ts`.
- **AI credits and console**: prepaid wallets, ledger, price controls, console section `#/ai` (`src/console/ai.tsx`, `server/routes/consoleAi.ts`, `server/aiCredits.ts`). Details in `docs/AI_CREDITS.md`.
- Production env already set: `AI_RENDER_ENABLED=true`, `AI_RENDER_MONTHLY_CAP=100` (Cloud Run revision 00119 and later).

## 2. Agents that were still running when the session ended

Check `git branch` / `git worktree list` for `worktree-agent-*` branches that are not merged into `feat/responsive-adaptive`. Do not remove a worktree that holds a `node_modules` junction.

1. **Store speed fix** (agent `aa11815955b244fee`). Per-store control doc (design counts), in-memory index or queries for pagination, remove the 200-product fetch at boot, inline icons instead of the 1.14 MB font, preload the Maison chunk. Spec: `docs/PERF_STORE_DIAGNOSIS.md`; it should write `docs/PERF_STORE_FIX.md`. Needs: merge, `npx tsc --noEmit`, `npx vitest run`, differential test vs old query path, then push.
2. **PDF Editorial grid**: DONE and merged to main (commit 86ee08a). Open points: it uses jsPDF built-in Times/Helvetica, not Cormorant/Jost (swap point marked `ponytail:` in `src/cataloguePdf.ts`); products have no price field, so price only prints if a design has a numeric `price` ('Rs 3,42,000'); export is capped at 500 designs per PDF (`MAX_PDF_DESIGNS`); Garnet theme not rendered/checked.

If a worktree has uncommitted work from a cut-off agent, review `git diff` there and finish or discard it.

## 3. Owner decisions and actions (cannot be done by code)

- **Prices**: set real values in the console AI > Prices tab. Current placeholders: Rs 8 per render, Rs 12 for on-model, model cost table, USD to INR 95.
- **Credits**: non-founder stores have a zero balance, so their AI render is blocked (402 "Add credits") until topped up in the console. Bhakti is exempt (`aiFree`).
- **Sales contact**: `SALES_WHATSAPP` in `shared/sales.ts` is empty (owners see only the email).
- **Test real AI renders**: no real Vertex call has been made. Upload a few real pieces in each style (especially on-model, which can drift most) and check quality before relying on it. Cost is about Rs 3.2 per render on `gemini-nano-banana-2.1`.
- **Cloud Run settings** (recommended in the diagnosis, not yet applied; they cost a little more): min-instances 1, memory 1 Gi, lower concurrency (from 80). Request timeout is already 300 s.
- **Firestore indexes / migration**: whatever the speed-fix report lists (control doc build for existing stores, including Bhakti with 20,568 products).
- **Transition choice**: `docs/transition-picker/index.html` has 13 options. The owner chose the plain fade as the default; no 3D option was picked.
- **Older owner items** from earlier sessions (see memory `saas-live-status`): `scripts/enable-push.ps1`, remove `OTP_STATIC_CODE` once Meta WhatsApp is live, CONSOLE_ADMINS / IAP_AUDIENCE, delete test stores, duplicate root `photos/` in the media bucket.

## 4. Known issues to fix (from the QA reports in `docs/QA_MAISON.md`)

- Latest buyer round (home, portrait cards, shortlist, order-placed, header badges) had no separate QA pass: run a buyer QA at 390 and 1440 and compare Classic with commit `2ed2a17` for pixel changes.
- Latest owner screens: Today charts not re-shot after the final CSS; Message log not checked; Enquiries, Alerts, Messages, Buyers are skin-only and not reviewed in detail.
- Chart labels and the new Hindi strings have no Hindi review.
- The 14-day orders chart uses only the last 100 orders (busy stores see a truncated chart).
- Maison: BuyerTour skips the Catalogue step (tab gone); brand sits about 40px off-centre at 390px; "Filter and sort" clips slightly at 390px; check-mark draw uses `stroke-dashoffset`; "Order all" posts lines one at a time (needs a bulk endpoint).
- Classic: `Ph` (`src/layouts/emergent/ui.tsx`) now falls back to a placeholder on image error (small unrequested change; limit to Maison if wanted).
- AI credits: a crash between charge and result leaves a `pending` charge (manual refund in console with the render id; no sweeper); monthly cap counter is non-transactional and can overshoot by one; no payment gateway (manual top-up only); Android/Capacitor build was not run.
- AI picker: on-model with a populated tag, and the banner and Add collection screens that embed the picker, were not checked in a browser.
- Owners cannot preview Maison through "View as a buyer" was fixed; owners now see the store's layout.
- A header Shortlist icon no longer exists: Shortlist lives in the profile panel with a count badge on the profile icon.

## 5. Useful commands and facts

- Typecheck / tests: `npx tsc --noEmit`, `npx vitest run` (config excludes `.claude/**`). Playwright e2e: `PW_CHANNEL=msedge PW_WORKERS=1 npx playwright test <name>` (Chromium is not installed; use Edge).
- Dev server: use a port other than 3000.
- Files are CRLF; Node scripts must normalise `\r\n` before string replace.
- `git push origin HEAD:main` triggers Cloud Build and a production deploy. Rollback command: see memory `saas-live-status`.
- Never `git worktree remove` a worktree that holds a `node_modules` junction.
- Reports and screenshots: `docs/QA_MAISON.md`, `docs/qa-maison/**`, `docs/PERF_STORE_DIAGNOSIS.md`, `docs/AI_CREDITS.md`, `docs/AI_FEATURES_PLAN.md`, `docs/DESIGN_BENCHMARK.md`.
- Artifacts (open the HTML in a browser): `docs/transition-picker/index.html`, `docs/pdf-picker/index.html`, `docs/motion-artifact/index.html`.

## 6. Suggested order for the next session

1. `git status`, `git worktree list`, `git branch --no-merged`; read the two running agents' reports or finish their worktrees.
2. Merge the speed fix and the PDF work; run tsc and vitest; push.
3. Apply or approve the Cloud Run settings and run the store migration the speed report lists; re-measure `bhakti.antarixs.com` (the diagnosis table has the baseline: page of 24 at 2.6 s median, boot 4.9 s).
4. Run the QA pass on the latest buyer and owner changes; fix findings.
5. Owner actions in section 3.
