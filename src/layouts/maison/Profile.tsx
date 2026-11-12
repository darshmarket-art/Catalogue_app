import React, { useEffect, useState } from 'react';
import type { ActiveScreen, Category } from '../../types';
import { usePlan } from '../../plan';
import { merchant } from '../../merchant';
import { LangToggle } from '../../components/LangToggle';
import type { ProfileUser } from '../../components/ProfileMenu';
import { canInstall, onInstallChange, promptInstall } from '../../install';
import { Icon } from '../emergent/ui';
import { hn, t, ts, useLang } from '../../i18n';
import { openService } from '../../services';
import { Drawer } from './ui';
import { ReportProblem } from './About';

/** 919876543210 reads as +91 98765 43210. */
const mobile = (p?: string) => (p && /^91\d{10}$/.test(p) ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : p);

/**
 * The buyer's profile, in Maison's look: a full-height panel on phones and a side panel on desktop (the Drawer). It carries the same things as the
 * Classic profile menu (name, phone, orders, about, the app tour, sign out) plus language, shortlist, report a problem and install.
 */
/** The phone menu's way into the catalogue: every category, and under the open one its collections. */
export interface Browse { groups: Array<[string, Category[]]>; onTag: (tag: string) => void; onCollection: (name: string) => void; onAll: () => void }

export const ProfilePanel: React.FC<{ buyer: ProfileUser; shortlistCount?: number; orderCount?: number; browse?: Browse; onClose: () => void; onOpenOrders: (tab: 'current' | 'past') => void; onGo: (s: ActiveScreen) => void; onLogout: () => void }> = ({ buyer, shortlistCount = 0, orderCount = 0, browse, onClose, onOpenOrders, onGo, onLogout }) => {
  useLang();
  const [openTag, setOpen] = useState<string | null>(null);
  const orders = usePlan().flags.orders;
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  const gst = buyer.gstin && buyer.gstin !== 'PENDING-VERIFY' ? buyer.gstin : undefined;
  const details: Array<[string, string | undefined]> = [[t('Owner'), buyer.ownerName], [t('Mobile'), mobile(buyer.phone)], [t('GST'), gst]];
  const row = (label: string, onClick: () => void, opts: { testId?: string; icon: string; count?: number } = { icon: 'next' }) => (
    <li key={label}>
      <button type="button" className="mx-prow" data-testid={opts.testId} onClick={onClick}>
        <span>{label}</span>
        <span className="mx-prow-r">{opts.count ? <b className="mx-rc" data-testid={opts.testId ? `${opts.testId}-count` : undefined}>{opts.count}</b> : null}<Icon n={opts.icon} size={16} /></span>
      </button>
    </li>
  );
  return (
    <Drawer label={browse ? t('Menu') : t('Profile')} onClose={onClose} testId="mx-profile-panel" tall>
      {browse && browse.groups.length > 0 && (
        <nav className="mx-idx" aria-label={t('Shop by Category')} data-testid="mx-index">
          <span className="mx-ey">{t('Shop by Category')}</span>
          <ul>
            {browse.groups.map(([tag, cs]) => {
              const on = tag === openTag;
              const one = cs.length === 1;
              return (
                <li key={tag} className={on ? 'on' : ''}>
                  <button type="button" className="mx-idx-tag" data-testid="mx-index-tag" aria-expanded={one ? undefined : on} onClick={() => (one ? browse.onCollection(cs[0].name) : setOpen(on ? null : tag))}>
                    <span>{ts(tag)}</span>{one ? <Icon n="next" size={16} /> : <Icon n={on ? 'up' : 'chev'} size={16} />}
                  </button>
                  {on && !one && (
                    <ul className="mx-idx-cols">
                      {cs.map((c) => <li key={c.id}><button type="button" data-testid="mx-index-col" onClick={() => browse.onCollection(c.name)}>{hn(c.name, c.nameHi)}</button></li>)}
                      <li><button type="button" className="all" onClick={() => browse.onTag(tag)}>{t('All {name}', { name: ts(tag) })}</button></li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="mx-cta" data-testid="mx-index-all" onClick={browse.onAll}>{t('View all designs')}</button>
        </nav>
      )}
      <section className="mx-pid">
        <span className="mx-ey">{ts(merchant.brand.name)}</span>
        <h2 className="mx-h2 sm" data-testid="mx-profile-name">{buyer.storeName}</h2>
        <dl className="mx-dl mx-pdl">
          {details.map(([label, value]) => value ? <div key={label}><dt className="mx-ey">{label}</dt><dd>{value}</dd></div> : null)}
        </dl>
      </section>
      <ul className="mx-prows">
        {orders && row(t('My order'), () => onOpenOrders('current'), { icon: 'bag', testId: 'mx-orders-row', count: orderCount })}
        {orders && row(t('Past orders'), () => onOpenOrders('past'), { icon: 'package' })}
        {row(t('Shortlist'), () => onGo('shortlist'), { icon: 'heart', testId: 'mx-shortlist-row', count: shortlistCount })}
        {browse && row(t('Private viewing'), () => { onClose(); openService({ kind: 'viewing' }); }, { icon: 'clock', testId: 'menu-viewing' })}
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
