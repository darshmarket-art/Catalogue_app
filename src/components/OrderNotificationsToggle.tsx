import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { usePlan } from '../plan';
import { I, Notice, Switch } from './ui';

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Admin Hub "Alerts" switch: this device gets a push when an order arrives. Hidden when push is unsupported or off on the server. */
export const OrderNotificationsToggle: React.FC = () => {
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

  if (!key) return null;

  const toggle = async () => {
    setError(null);
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

  return (
    <>
      <div className="card row" style={{ padding: '0 12px', height: 54, gap: 8, flex: 'none' }}>
        <I n="bell" size="s" style={{ color: 'var(--plum)' }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Alerts</span>
        <Switch on={on} onChange={toggle} label="Order alerts on this device" />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
};
