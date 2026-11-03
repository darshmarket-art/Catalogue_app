import React, { useEffect, useState } from 'react';
import type { ActiveScreen } from '../../types';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { ProfileMenu } from '../../components/ProfileMenu';
import { LangToggle } from '../../components/LangToggle';
import { Icon, type KitProps } from '../emergent/ui';
import { useDesktop } from '../emergent/useDesktop';
import { useBackLayer } from '../../backLayer';
import { hn, t, tn, ts, useLang } from '../../i18n';
import { groupByTag, useTagList } from '../../tagList';

// Desktop nav row. Shortlist and Orders are the icons in the bar; About us is also in the Collections drawer and the Home footer.
const NAV: Array<{ screen: ActiveScreen; label: string }> = [
  { screen: 'categories', label: 'Home' },
  { screen: 'catalogue', label: 'Catalogue' },
  { screen: 'about', label: 'About us' }
];
const SUB: ActiveScreen[] = ['retailer-auth', 'admin-login'];

/**
 * Maison's masthead. Desktop: a centred wordmark, a few sections underneath, and a mega-menu under "Collections" that indexes the collections by
 * tag with design counts. Phones: a "Collections" button opens the same index as a drawer. Sign-in pages get a back arrow instead.
 */
export const Header: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, currentMerchant, onLogout, onOpenOrders, categories = [], shortlistCount = 0, orderCount, onOpenCollection }) => {
  useLang();
  const desk = useDesktop();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const sub = SUB.includes(currentScreen);
  useEffect(() => { setMenu(false); setMega(false); }, [currentScreen]);
  useEffect(() => { if (desk) setMenu(false); }, [desk]);

  const go = (s: ActiveScreen) => { setMenu(false); setMega(false); onNavigate(s); };
  const openCol = (name: string) => { setMenu(false); setMega(false); onOpenCollection?.(name); };
  const nav = NAV;
  const tagOrder = useTagList();
  const groups = groupByTag([...categories].sort((a, b) => b.designCount - a.designCount), tagOrder);

  const account = currentMerchant ? (
    <ProfileMenu buyer={currentMerchant} isAdmin={false} onOpenOrders={onOpenOrders} onOpenAdminConsole={() => {}} onOpenAbout={() => go('about')} onLogout={onLogout} onNavigate={onNavigate} />
  ) : (
    <button type="button" className="mx-ib" aria-label={t('Sign in')} onClick={() => go('retailer-auth')}><Icon n="user" size={20} /></button>
  );
  const counts = (
    <>
      <button type="button" className="mx-ib" data-tab="shortlist" aria-label={t('Shortlist')} onClick={() => go('shortlist')}>
        <Icon n="heart" size={20} />{shortlistCount > 0 && <b className="mx-ct">{shortlistCount}</b>}
      </button>
      {orderCount !== undefined && (
        <button type="button" className="mx-ib" data-tab="orders" aria-label={t('Orders')} onClick={() => go('orders')}>
          <Icon n="bag" size={20} />{orderCount > 0 && <b className="mx-ct">{orderCount}</b>}
        </button>
      )}
    </>
  );
  const word = (
    <button type="button" className="mx-word" aria-label={ts(merchant.brand.name)} onClick={() => go('categories')}>
      <BrandMark className="mx-logo" textClassName="text-[18px]" />
      <span>{ts(merchant.brand.name)}</span>
    </button>
  );

  return (
    <header className={`mx-top${mega ? ' open' : ''}`} onMouseLeave={() => setMega(false)}>
      <div className="mx-bar">
        <div className="mx-side">
          {sub ? (
            <button type="button" className="mx-ib" aria-label={t('Back')} onClick={() => onNavigate('welcome')}><Icon n="back" size={22} /></button>
          ) : desk ? (
            <button type="button" className="mx-ib" aria-label={t('Search the catalogue')} onClick={() => go('catalogue')}><Icon n="search" size={20} /></button>
          ) : (
            <button type="button" className="mx-nl mx-coll" data-tab="catalogue" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>{t('Collections')}</button>
          )}
          {desk && <LangToggle />}
        </div>
        {word}
        <div className="mx-side r">
          {!sub && desk && account}
          {!sub && counts}
          {sub && !desk && <LangToggle />}
        </div>
      </div>

      {desk && !sub && (
        <nav className="mx-nav" aria-label="Main">
          <NavBtn tab="categories" on={currentScreen === 'categories'} onClick={() => go('categories')}>{t('Home')}</NavBtn>
          {groups.length > 0 && (
            <button type="button" className={`mx-nl${mega ? ' on' : ''}`} aria-expanded={mega} onMouseEnter={() => setMega(true)} onClick={() => setMega((m) => !m)}>{t('Collections')}</button>
          )}
          {nav.slice(1).map((n) => <NavBtn key={n.screen} tab={n.screen} on={currentScreen === n.screen} onClick={() => go(n.screen)}>{t(n.label)}</NavBtn>)}
        </nav>
      )}

      {desk && mega && (
        <div className="mx-mega" data-testid="mx-mega">
          <div className="mx-mega-in"><TagIndex groups={groups} onCol={openCol} onAll={() => go('catalogue')} /></div>
        </div>
      )}

      {menu && <MobileMenu nav={nav} orders={orderCount !== undefined} groups={groups} current={currentScreen} account={account} onGo={go} onCol={openCol} onClose={() => setMenu(false)} />}
    </header>
  );
};

const NavBtn: React.FC<{ tab: string; on: boolean; onClick: () => void; children: React.ReactNode }> = ({ tab, on, onClick, children }) => (
  <button type="button" data-tab={tab} className={`mx-nl${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>{children}</button>
);

type Groups = ReturnType<typeof groupByTag<NonNullable<KitProps<'Header'>['categories']>[number]>>;

/** Collections filed under their tag: "RINGS 42" then each collection with its design count. Used by the mega-menu and the drawer. */
const TagIndex: React.FC<{ groups: Groups; onCol: (n: string) => void; onAll: () => void }> = ({ groups, onCol, onAll }) => (
  <div className="mx-tags-ix">
    {groups.map(([tag, cs], i) => (
      <section key={tag} className="mx-tagg" style={{ ['--i' as string]: i }}>
        <h3 className="mx-tagh"><span>{tag}</span><i>{cs.reduce((n, c) => n + c.designCount, 0)}</i></h3>
        <ul>
          {cs.map((c) => (
            <li key={c.id}><button type="button" onClick={() => onCol(c.name)}><span>{hn(c.name, c.nameHi)}</span><i aria-label={tn(c.designCount, '{n} design', '{n} designs')}>{c.designCount}</i></button></li>
          ))}
        </ul>
      </section>
    ))}
    <button type="button" className="mx-cta mx-all" onClick={onAll}>{t('All designs')}</button>
  </div>
);

const MobileMenu: React.FC<{ nav: typeof NAV; orders: boolean; groups: Groups; current: ActiveScreen; account: React.ReactNode; onGo: (s: ActiveScreen) => void; onCol: (n: string) => void; onClose: () => void }> = ({ nav, orders, groups, current, account, onGo, onCol, onClose }) => {
  useBackLayer(true, onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.documentElement.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="mx-menu" role="dialog" aria-modal="true" aria-label={t('Collections')}>
      <div className="mx-bar">
        <div className="mx-side"><button type="button" className="mx-ib" aria-label={t('Close')} onClick={onClose} autoFocus><Icon n="x" size={22} /></button></div>
        <span className="mx-word"><span>{ts(merchant.brand.name)}</span></span>
        <div className="mx-side r"><LangToggle /></div>
      </div>
      <div className="mx-menu-c">
        {groups.length === 0 ? <p className="mx-note">{t('No collections have been added yet.')}</p> : <TagIndex groups={groups} onCol={onCol} onAll={() => onGo('catalogue')} />}
      </div>
      <div className="mx-menu-f">
        <nav className="mx-menu-l">
          {nav.filter((n) => n.screen !== 'catalogue').map((n) => (
            <button key={n.screen} type="button" aria-current={current === n.screen ? 'page' : undefined} onClick={() => onGo(n.screen)}>{t(n.label)}</button>
          ))}
          <button type="button" aria-current={current === 'shortlist' ? 'page' : undefined} onClick={() => onGo('shortlist')}>{t('Shortlist')}</button>
          {orders && <button type="button" aria-current={current === 'orders' ? 'page' : undefined} onClick={() => onGo('orders')}>{t('Orders')}</button>}
        </nav>
        {account}
      </div>
    </div>
  );
};
