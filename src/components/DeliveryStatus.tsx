import React, { useEffect, useState } from 'react';
import { api, type FailureKind, type MessageStatus } from '../api';
import { t } from '../i18n';

export const STATUS_LABEL: Record<MessageStatus, string> = { accepted: 'Sending…', sent: 'Sent', delivered: 'Delivered ✓', read: 'Read ✓', failed: 'Not delivered' };
export const statusTone = (s: MessageStatus) => (s === 'failed' ? 'bad' : s === 'delivered' || s === 'read' ? 'ok' : s === 'sent' ? 'mut' : 'warn');

export const FAILURE_TEXT: Record<FailureKind, string> = {
  'not-on-whatsapp': "This number isn't on WhatsApp. Check it or try another number.",
  undeliverable: "WhatsApp couldn't deliver the code yet. Resend it or try another number.",
  other: 'The code could not be delivered. Please resend it.'
};

/** Small calm pill for a message's delivery stage. */
export const DeliveryPill: React.FC<{ status: MessageStatus; testId?: string }> = ({ status, testId }) => (
  <span className={`tag ${statusTone(status)}`} data-testid={testId}>
    {t(STATUS_LABEL[status])}
  </span>
);

/** Polls a sign-in code's delivery until it settles (or ~2 minutes pass). Only meaningful when receipts are connected. */
export function useOtpDelivery(messageId: string | null, enabled: boolean, onFailed?: (f: FailureKind | null) => void) {
  const [status, setStatus] = useState<MessageStatus | null>(null);
  const [failure, setFailure] = useState<FailureKind | null>(null);
  useEffect(() => {
    setStatus(null);
    setFailure(null);
    if (!messageId || !enabled) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await api.otpStatus(messageId);
        if (stop) return;
        setStatus(r.status);
        setFailure(r.failure);
        if (r.status === 'failed') return void onFailed?.(r.failure);
        if (r.status === 'delivered' || r.status === 'read') return;
      } catch {
        return;
      }
      if (++tries < 40) setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [messageId, enabled]);
  return { status, failure };
}
