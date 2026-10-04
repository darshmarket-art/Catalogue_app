import { Notice } from './ui';

/** Shown only outside production: the server echoes the code so nobody needs WhatsApp to test. */
export function DevOtpHint({ code, channel }: { code: string | null; channel?: string | null }) {
  if (!code) return null;
  return (
    <Notice tone="warn">
      <span data-testid="dev-otp-hint">
        {channel === 'whatsapp' ? (
          <>Test mode: your code is <b>{code}</b>. It was also sent to you on WhatsApp.</>
        ) : (
          <>Development mode: your code is <b>{code}</b>. Nothing is sent on WhatsApp until live delivery is configured.</>
        )}
      </span>
    </Notice>
  );
}
