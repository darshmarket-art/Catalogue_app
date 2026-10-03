# WhatsApp OTP setup (owner steps, Phase 0)

Buyers sign in with a 6-digit code sent on WhatsApp through Meta's WhatsApp Cloud API. The code is ready; these steps give it a real sender. Start now: business verification takes days.

## 1. Meta Business account and verification
1. Go to business.facebook.com and create a Business Account for Antarixs (use the company's legal name).
2. Business Settings > Security Centre > Start verification. Upload the registration documents (GST certificate, incorporation or shop licence, a utility bill or bank statement showing the same name and address) and verify by the phone, email or domain option offered.
3. Wait for "Verified". Message limits and template approval work without it at first, but verification is needed to go beyond the starter limits.

## 2. Create the app and add a number
1. developers.facebook.com > My Apps > Create App > type **Business**, attach your verified Business Account.
2. Add the **WhatsApp** product to the app. This creates a WhatsApp Business Account (WABA).
3. WhatsApp > API Setup > Add phone number. Use a number that:
   - can receive an SMS or call for verification, and
   - is NOT registered in the normal WhatsApp or WhatsApp Business app (delete that account first; once on the Cloud API the number can no longer be used in the phone app).
4. Set a display name (Antarixs), complete verification. Note the **Phone number ID** shown on API Setup. This is `WHATSAPP_PHONE_NUMBER_ID` (it is not the phone number itself).
5. Add a payment method in WhatsApp Manager > Payment settings. Authentication messages are billed per message; without a method sends fail.

## 3. Create the authentication template
1. business.facebook.com > WhatsApp Manager > Message templates > Create template.
2. Category: **Authentication**. Name: `antarixs_login_otp` (lowercase, underscores). Language: English (`en`), the code the server defaults to; if you pick another set `WHATSAPP_OTP_LANGUAGE`.
3. Code delivery: **Copy code** button. Tick "Add security recommendation" and set expiry to 5 minutes.
4. Submit. Approval usually takes minutes to a day. The name is `WHATSAPP_OTP_TEMPLATE`.

## 4. Permanent access token (system user)
The temporary token on API Setup expires in 24 hours; do not use it.
1. Business Settings > Users > System users > Add. Name `antarixs-otp`, role **Admin**.
2. Add Assets > Apps: your app, with full control. Add Assets > WhatsApp accounts: your WABA, with full control.
3. Generate New Token: choose the app, expiry **Never**, permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy it now; it is shown once. This is `WHATSAPP_TOKEN`.

## 5. Test from your terminal
```
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"91XXXXXXXXXX","type":"template","template":{"name":"antarixs_login_otp","language":{"code":"en"},"components":[{"type":"body","parameters":[{"type":"text","text":"123456"}]},{"type":"button","sub_type":"url","index":"0","parameters":[{"type":"text","text":"123456"}]}]}}'
```
You should receive the message on WhatsApp. An error 132001 means the template name or language is wrong; 190 means a bad token.

## 6. Cloud Run secrets (Secret Manager)
Never put the token in the repo or `.env` on the server.
```
gcloud secrets create whatsapp-token --replication-policy=automatic
printf '%s' '<TOKEN>' | gcloud secrets versions add whatsapp-token --data-file=-
gcloud secrets add-iam-policy-binding whatsapp-token \
  --member="serviceAccount:<CLOUD_RUN_SERVICE_ACCOUNT>" --role="roles/secretmanager.secretAccessor"
gcloud run services update <SERVICE> --region asia-south1 \
  --update-secrets=WHATSAPP_TOKEN=whatsapp-token:latest \
  --update-env-vars=WHATSAPP_PHONE_NUMBER_ID=<PHONE_NUMBER_ID>,WHATSAPP_OTP_TEMPLATE=antarixs_login_otp,WHATSAPP_API_VERSION=v21.0
```
Optional: `WHATSAPP_OTP_LANGUAGE` (default `en`), `OTP_DAILY_CAP` (sends per day, default 500).

## Behaviour to know
- Local development with no variables set: the code is printed in the server log. In production with the variables missing, code requests fail with "Could not send the code"; codes are never logged.
- Meta only lets a business start a conversation with a template message; the OTP template is that message, so no 24-hour window issue applies.
- Rotate the token by adding a new secret version and redeploying.
