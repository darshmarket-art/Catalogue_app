import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import { Notice, Switch } from './ui';
import { Icon } from '../layouts/emergent/ui';

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Admin Hub "Alerts" switch: this device gets a push when an order arrives. Hidden when push is unsupported or off on the server. */
/** `row` lays it out like a row of the store settings list (icon, text, switch) so it lines up with its neighbours; otherwise it is its own card. */
export const OrderNotificationsToggle: React.FC<{ row?: boolean }> = ({ row }) => {
  const { flags } = usePlan();
  const [key, setKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (!supported || !flags.alerts) return;
    api
      .pushKey()
      .then(async (k) => {
        setKey(k);
        setOn(Boolean(await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()));
      })
      .catch(() => {});
  }, [supported, flags.alerts]);

  const toggle = async () => {
    setError(null);
    if (!flags.alerts) return void upgradeNotice('Order alerts');
    if (!key) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await api.pushUnsubscribe(existing.endpoint);
        await existing.unsubscribe();
        setOn(false);
        return;
      }
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked in this browser.');
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      await api.pushSubscribe(s.toJSON());
      setOn(true);
    } catch (e: any) {
      setError(e.message || 'Could not change notifications.');
    }
  };

  const note = !flags.alerts ? 'Pro feature' : key ? 'WhatsApp and phone notifications' : supported ? 'Not set up for this store yet' : 'Not supported in this browser';
  if (row) {
    return (
      <>
        <div className="em-li" data-testid="store-alerts" style={{ borderBottom: '1px solid var(--em-line)' }}>
          <span className="em-circ" style={{ background: 'var(--em-tint)' }}>
            <Icon n="bell" size={18} />
          </span>
          <span className="em-grow">
            <b style={{ display: 'block', fontWeight: 600 }}>Alerts</b>
            <span className="em-mut" style={{ fontSize: 12 }}>{note}</span>
          </span>
          <Switch on={on} onChange={toggle} label="Alerts on this device" />
        </div>
        {error && <p role="alert" style={{ color: 'var(--em-bad)', fontSize: 13, margin: '6px 0 10px' }}>{error}</p>}
      </>
    );
  }
  return (
    <>
      <div className="card em-row em-sb" style={{ gap: 12 }}>
        <div>
          <div style={{ fontWeight: 500 }}>Alerts</div>
          <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
            {!flags.alerts ? 'Pro feature' : key ? 'WhatsApp and phone notifications' : supported ? 'Not set up for this store yet' : 'Not supported in this browser'}
          </div>
        </div>
        <Switch on={on} onChange={toggle} label="Alerts on this device" />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
};
