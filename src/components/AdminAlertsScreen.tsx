import React, { useEffect, useState } from 'react';
import { api, type AlertSettings, type AlertTestResult } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import { Field, Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';

const pretty = (n: string) => `+${n}`;

/** Owner alert settings: up to three WhatsApp numbers hear about orders, a test send, and the exact wording Meta approved. */
export const AdminAlertsScreen: React.FC = () => {
  const { flags } = usePlan();
  const [data, setData] = useState<AlertSettings | null>(null);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [test, setTest] = useState<AlertTestResult | null>(null);

  useEffect(() => {
    api.getAlerts().then((d) => { setData(d); setNumbers(d.numbers); }).catch((e) => setErr(e.message));
  }, []);

  const run = async (fn: () => Promise<string | null>) => {
    if (!flags.alerts) return void upgradeNotice('WhatsApp alerts');
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      setOk(await fn());
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    let digits = draft.replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`; // Indian number typed without the country code
    setErr(null);
    if (digits.length < 8 || digits.length > 15) return setErr('Enter the number with its country code, e.g. 91 98765 43210.');
    if (numbers.includes(digits)) return setErr('That number is already on the list.');
    if (data && numbers.length >= data.maxNumbers) return setErr(`Up to ${data.maxNumbers} numbers can receive alerts.`);
    setNumbers([...numbers, digits]);
    setDraft('');
  };

  const save = () => run(async () => { setData(await api.saveAlerts(numbers)); return 'Alert numbers saved.'; });
  const sendTest = () => run(async () => { setTest(await api.testAlert()); return null; });
  const dirty = data !== null && JSON.stringify(numbers) !== JSON.stringify(data.numbers);

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="admin-alerts-screen">
      <p className="sub">When a buyer places or cancels an order, these WhatsApp numbers hear about it. The daily "catalogue full" nudge goes to the same numbers.</p>
      {!flags.alerts && (
        <Notice tone="warn">
          <span data-testid="alerts-pro-notice">WhatsApp alerts are a Pro feature. You can look around; saving and testing need Pro.</span>
        </Notice>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      {ok && <Notice tone="ok">{ok}</Notice>}

      {data === null ? (
        <div className="card em-skel" style={{ height: 72 }} />
      ) : (
        <>
          <div className="card col" style={{ gap: 6 }} data-testid="alerts-status">
            <StatusLine label="WhatsApp alerts" on={data.whatsappConfigured} onText="Connected" offText="Not connected on the platform yet" testId="alerts-status-whatsapp" />
            <StatusLine label="Phone notifications" on={data.pushConfigured} onText="Available" offText="Not set up" testId="alerts-status-push" />
            <StatusLine label="Delivery receipts" on={data.receiptsConnected} onText="Connected" offText="Not connected" testId="alerts-status-receipts" />
          </div>

          <div className="card col" style={{ gap: 10 }}>
            <b style={{ fontWeight: 600 }}>Numbers that receive alerts</b>
            {numbers.map((n) => (
              <div key={n} className="em-row em-sb" data-testid="alert-number-row" style={{ gap: 10 }}>
                <span style={{ fontWeight: 500 }}>
                  {pretty(n)}
                  {n === data.defaultNumber && <span className="tag mut" style={{ marginLeft: 8 }}>Store number</span>}
                </span>
                <button type="button" className="btn alt danger sm" data-testid="alert-number-remove" disabled={busy || numbers.length <= 1} title={numbers.length <= 1 ? 'Keep at least one number' : undefined} onClick={() => setNumbers(numbers.filter((x) => x !== n))}>
                  Remove
                </button>
              </div>
            ))}
            {numbers.length < data.maxNumbers && (
              <form onSubmit={add} className="em-row" style={{ gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Add a WhatsApp number" htmlFor="alert-number" hint="With country code, e.g. 91 98765 43210 (a 10-digit Indian number gets 91 added)">
                    <input id="alert-number" data-testid="alert-number-input" className="inp" type="tel" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d ]/g, '').slice(0, 18))} placeholder="91 98765 43210" />
                  </Field>
                </div>
                <button type="submit" className="btn alt sm" data-testid="alert-number-add" disabled={busy || draft.replace(/\D/g, '').length < 8} style={{ marginBottom: 22 }}>
                  <Icon n="plus" size={16} />
                  Add
                </button>
              </form>
            )}
            <button type="button" className="btn sm" data-testid="alert-numbers-save" disabled={busy || !dirty} onClick={save}>
              {busy ? 'Saving…' : 'Save numbers'}
            </button>
          </div>

          <div className="card col" style={{ gap: 10 }}>
            <b style={{ fontWeight: 600 }}>Send a test alert</b>
            <p className="sub" style={{ margin: 0, fontSize: 13 }}>A sample "order placed" alert goes to every number above and to devices with notifications on.</p>
            <button type="button" className="btn wa sm" data-testid="alert-test-button" disabled={busy} onClick={sendTest}>
              <Icon n="wa" size={16} />
              {busy ? 'Sending…' : 'Send test alert'}
            </button>
            {test && (
              <div className="col" style={{ gap: 6 }} data-testid="alert-test-results">
                {test.results.map((r) => (
                  <div key={r.to} className="em-row em-sb" data-testid="alert-test-result" style={{ gap: 10, fontSize: 13.5 }}>
                    <span>{r.to}</span>
                    <span className={`tag ${r.ok ? 'ok' : 'warn'}`}>{r.ok ? 'Accepted by WhatsApp' : r.error}</span>
                  </div>
                ))}
                <span className="sub" style={{ fontSize: 13 }} data-testid="alert-test-pushed">
                  Phone notifications sent: {test.pushed}
                </span>
                {!test.whatsappConfigured && <span className="sub" style={{ fontSize: 13 }}>WhatsApp sending starts once the platform's Meta credentials and templates are in place.</span>}
              </div>
            )}
          </div>

          <div className="card col" style={{ gap: 8 }} data-testid="alert-wording">
            <b style={{ fontWeight: 600 }}>What alerts look like</b>
            <Wording label="Order placed" text={data.wording.placed} />
            <Wording label="Order cancelled" text={data.wording.cancelled} />
            <Wording label="Catalogue full (once a day)" text={data.wording.storeFull} />
          </div>
        </>
      )}
    </div>
  );
};

const StatusLine: React.FC<{ label: string; on: boolean; onText: string; offText: string; testId: string }> = ({ label, on, onText, offText, testId }) => (
  <div className="em-row em-sb" style={{ fontSize: 13.5 }}>
    <span>{label}</span>
    <span className={`tag ${on ? 'ok' : 'mut'}`} data-testid={testId}>{on ? onText : offText}</span>
  </div>
);

const Wording: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div>
    <div className="em-mut" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>
  </div>
);
