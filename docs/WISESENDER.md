# WiseSender for WhatsApp sign-in codes

Source of the API: https://app.wisesender.in/api/docs/ (and its "WhatsApp Authentication Template API" document).

## How it works here
Our server makes its own 6-digit code (stored hashed, 5 minutes, 5 tries, 30 s resend, same as with Meta) and sends it through WiseSender as an approved **Authentication template**: `POST {base}/api/{vendorUid}/contact/send-template-message` with `Authorization: Bearer {token}` and `{ phone_number, template_name, template_language, field_1: code, copy_code: code }` (code in the body and on the copy-code button). Buyer sign-in, new-store sign-up and the admin's forgotten-password code all use it. Code: `WiseSenderOtpSender` in `server/whatsapp.ts`.

WiseSender also has its own `send-otp` / `verify-otp` API (it makes and checks the code itself, 3 per 5 minutes per number). It was not used: it would mean a second code flow for every screen. It can be added later if you prefer it.

## Settings (Cloud Run)
| Setting | Value |
|---|---|
| `WISESENDER_VENDOR_UID` | Settings > API Access > "Your Vendor UID" |
| `WISESENDER_TOKEN` | Settings > API Access > "Generate New Token" (kept in Secret Manager as `wisesender-token`) |
| `WISESENDER_OTP_TEMPLATE` | name of your approved Authentication template |
| `WISESENDER_OTP_LANGUAGE` | template language, default `en_US` |
| `WISESENDER_BASE_URL` | optional, default `https://app.wisesender.in` |

When these exist, WiseSender is chosen automatically as the code provider and the static code stops being accepted. `OTP_PROVIDER=wisesender` forces it (and refuses to start if a setting is missing).

## One-time steps
1. In WiseSender create an **Authentication** template (name e.g. `catalogue_login_otp`, English, with the **Copy code** button) and wait for Meta's approval. Check the name and language match exactly.
2. Settings > API Access > Generate New Token.
3. Run `.\scripts\set-wisesender.ps1` from the repo root: it asks for the three values (the token is typed hidden) and sets the secret and the Cloud Run settings.
4. Sign in on a store with a real number; the code should arrive on WhatsApp.
5. Then remove `OTP_STATIC_CODE` from Cloud Run.

## Notes
- The account showed a free trial ("5 days remaining, expires 09 Oct 2026") on 2026-10-05; sending needs an active plan and the wallet funded.
- Delivery receipts (the "Delivered" tick on the code screen) are Meta-only; with WiseSender the screen just shows the code boxes. WiseSender can forward its own webhook to an endpoint; that is not wired.
- Order alerts and the trial reminders still use the Meta settings; they are not moved to WiseSender yet.
