// Checks the WhatsApp OTP setup and optionally sends a test code.
// Usage: npx tsx --env-file=.env scripts/whatsapp-check.ts [--send 9198XXXXXXXX]
import crypto from 'crypto';
import { loadConfig } from '../server/config';
import { MetaOtpSender, WhatsAppSendError } from '../server/whatsapp';

async function main() {
  const config = loadConfig();
  console.log(`OTP provider: ${config.otpProvider}`);
  if (config.otpProvider !== 'whatsapp') {
    console.log(config.staticOtp ? `Fixed development code in use (OTP_STATIC_CODE=${config.staticOtp}); nothing is sent.` : 'Codes are printed to the server log; nothing is sent.');
    console.log('To go live set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE in .env (see .env.example).');
    return;
  }
  const c = config.whatsapp!;
  const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`, {
    headers: { Authorization: `Bearer ${c.token}` }
  });
  const info: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Token / phone number check FAILED:', JSON.stringify(info.error ?? info, null, 2));
    console.error('Common causes: expired 24-hour test token, wrong WHATSAPP_PHONE_NUMBER_ID, or the token lacks whatsapp_business_messaging.');
    process.exitCode = 1;
    return;
  }
  console.log(`Sender OK: ${info.verified_name ?? '?'} (${info.display_phone_number ?? '?'}), quality=${info.quality_rating ?? '?'}, verification=${info.code_verification_status ?? '?'}`);
  console.log(`Template: ${c.template} / ${c.language}  API: ${c.apiVersion}`);

  const i = process.argv.indexOf('--send');
  const to = i > -1 ? process.argv[i + 1]?.replace(/\D/g, '') : '';
  if (!to) {
    console.log('Add --send <phone with country code> to deliver a test code.');
    return;
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  try {
    await new MetaOtpSender(c).sendOtp(to, code);
    console.log(`Accepted by Meta: test code ${code} is on its way to ${to}. Check WhatsApp.`);
  } catch (e) {
    const err = e as WhatsAppSendError;
    console.error(`Send FAILED: ${err.message}`, err.traceId ? `(fbtrace_id ${err.traceId})` : '');
    if (err.metaCode === 132001) console.error('The template name/locale does not match an approved template.');
    if (err.metaCode === 132000 || err.metaCode === 132012) console.error('Parameter mismatch: the template must be Authentication category with a copy-code button.');
    if (err.metaCode === 131026) console.error('That number is not reachable on WhatsApp (test numbers must be added as recipients in API Setup).');
    process.exitCode = 1;
  }
}

main();
