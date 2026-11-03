import React, { useEffect, useState } from 'react';
import type { ActiveScreen } from '../../types';
import { usePlan } from '../../plan';
import { merchant } from '../../merchant';
import { LangToggle } from '../../components/LangToggle';
import type { ProfileUser } from '../../components/ProfileMenu';
import { canInstall, onInstallChange, promptInstall } from '../../install';
import { Icon } from '../emergent/ui';
import { t, ts, useLang } from '../../i18n';
import { Drawer } from './ui';
import { ReportProblem } from './About';

/**
 * The buyer's profile, in Maison's look: a full-height panel on phones and a side panel on desktop (the Drawer). It carries the same things as the
 * Classic profile menu (name, phone, orders, about, the app tour, sign out) plus language, shortlist, report a problem and install.
 */
export const ProfilePanel: React.FC<{ buyer: ProfileUser; onClose: () => void; onOpenOrders: (tab: 'current' | 'past') => void; onGo: (s: ActiveScreen) => void; onLogout: () => void }> = ({ buyer, onClose, onOpenOrders, onGo, onLogout }) => {
  useLang();
  const orders = usePlan().flags.orders;
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  const gst = buyer.gstin && buyer.gstin !== 'PENDING-VERIFY' ? buyer.gstin : undefined;
  const details: Array<[string, string | undefined]> = [[t('Owner'), buyer.ownerName], [t('Mobile'), buyer.phone], [t('GST'), gst]];
  const row = (label: string, onClick: () => void, opts: { testId?: string; icon: string } = { icon: 'next' }) => (
    <li key={label}>
      <button type="button" className="mx-prow" data-testid={opts.testId} onClick={onClick}>
        <span>{label}</span><Icon n={opts.icon} size={16} />
      </button>
    </li>
  );
  return (
    <Drawer label={t('Profile')} onClose={onClose} testId="mx-profile-panel" tall>
      <section className="mx-pid">
        <span className="mx-ey">{ts(merchant.brand.name)}</span>
        <h2 className="mx-h2 sm" data-testid="mx-profile-name">{buyer.storeName}</h2>
        <dl className="mx-dl mx-pdl">
          {details.map(([label, value]) => value ? <div key={label}><dt className="mx-ey">{label}</dt><dd>{value}</dd></div> : null)}
        </dl>
      </section>
      <ul className="mx-prows">
        {orders && row(t('My order'), () => onOpenOrders('current'), { icon: 'bag' })}
        {orders && row(t('Past orders'), () => onOpenOrders('past'), { icon: 'package' })}
        {row(t('Shortlist'), () => onGo('shortlist'), { icon: 'heart' })}
        {row(t('About us'), () => onGo('about'), { icon: 'info' })}
        {row(t('Take the app tour'), () => { onClose(); window.dispatchEvent(new Event('app-tour')); }, { icon: 'star', testId: 'menu-tour' })}
        {installable && row(t('Install app'), () => { void promptInstall(); }, { icon: 'down', testId: 'menu-install' })}
      </ul>
      <div className="mx-pset">
        <span className="mx-ey">{t('Language')}</span>
        <LangToggle />
      </div>
      <div className="mx-pset col"><ReportProblem /></div>
      <button type="button" className="mx-btn sec mx-signout" data-testid="menu-logout" onClick={onLogout}>{t('Log out')}</button>
    </Drawer>
  );
};
