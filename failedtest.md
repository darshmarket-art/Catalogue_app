# Failing tests (known, not fixed by decision)

Baseline: `npx vitest run --testTimeout=60000` → 246 passed / 4 failed (26 files) after Phase 1.
All four are pre-Phase-1 assertions that now contradict the approved Phase 1 spec. They are not product bugs.
Each needs one of two decisions: **(A)** update the test to the new spec, or **(B)** revert the behaviour.

| # | File | Test name | What it asserts | Why it fails now | Suggested decision |
|---|------|-----------|-----------------|------------------|--------------------|
| 1 | `tests/api.test.ts` | `no random HUID, never a price` | A created product has no `priceMode`/price fields | Phase 1 jewellery sector defaults `priceMode: 'by-weight'` on every product (`server/sectors/jewellery.ts`) | A — assert `priceMode === 'by-weight'` and no `fixedPrice` |
| 2 | `tests/api.test.ts` | `keeps a HUID … ignores price fields` | Price fields in the payload are silently dropped | Phase 1 validates and stores `priceMode`/`fixedPrice`/`makingChargePerGram`; a malformed `fixedPrice` now returns 400 | A — send a valid `fixedPrice` number and assert it is stored |
| 3 | `tests/cors.test.ts` | `7 days on the web` | Web buyer session token TTL is 7 days | Phase 1 set web buyer sessions to 30 days with sliding renewal (agreed range 7–30 days) | A — expect 30 days, or B — set `RETAILER_TOKEN_TTL` web value back to 7 days |
| 4 | `tests/phase2.test.ts` | `products carry no price` | Product create accepts `fixedPrice: '9000'` (string) and strips it | New schema requires a number; the string payload is rejected with 400 | A — send `fixedPrice: 9000` or drop the field and assert `priceMode` only |

## How to re-run just these
```bash
cd /app && npx vitest run tests/api.test.ts tests/cors.test.ts tests/phase2.test.ts --testTimeout=60000
```

## Status
- 2026-06: documented, left failing on purpose (user instruction: assume Phase 1 defaults, decide later).
