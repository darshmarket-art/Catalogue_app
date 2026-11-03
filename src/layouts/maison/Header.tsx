import React, { useEffect, useState } from 'react';
import type { ActiveScreen } from '../../types';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { ProfileMenu } from '../../components/ProfileMenu';
import { LangToggle } from '../../components/LangToggle';
import { Icon, Ph, type KitProps } from '../emergent/ui';
import { useDesktop } from '../emergent/useDesktop';
import { useBackLayer } from '../../backLayer';
import { hn, t, ts, useLang } from '../../i18n';
import { SIZES_GRID } from '../../photoSrcSet';

const NAV: Array<{ screen: ActiveScreen; label: string }> = [
  { screen: 'categories', label: 'Home' },
  { screen: 'catalogue', label: 'Catalogue' },
  { screen: 'shortlist', label: 'Shortlist' },
  { screen: 'orders', label: 'Orders' },
  { screen: 'about', label: 'About us' }
];
const SUB: ActiveScreen[] = ['retailer-auth', 'admin-login'];

/**
 * Maison's masthead. Desktop: a centred wordmark between a utility row, the sections underneath, and a collections mega-menu under
 * "Collections". Phones: menu, wordmark, bag; the menu opens full screen. Sign-in pages get a back arrow instead of the menu.
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
  const nav = NAV.filter((n) => n.screen !== 'orders' || orderCount !== undefined);
  const cols = [...categories].sort((a, b) => (a.heroOrder ?? 99) - (b.heroOrder ?? 99) || b.designCount - a.designCount);

  const account = currentMerchant ? (
    <ProfileMenu buyer={currentMerchant} isAdmin={false} onOpenOrders={onOpenOrders} onOpenAdminConsole={() => {}} onOpenAbout={() => go('about')} onLogout={onLogout} onNavigate={onNavigate} />
  ) : (
    <button type="button" className="mx-ib" aria-label={t('Sign in')} onClick={() => go('retailer-auth')}><Icon n="user" size={20} /></button>
  );
  const counts = (
    <>
      <button type="button" className="mx-ib" aria-label={t('Shortlist')} onClick={() => go('shortlist')}>
        <Icon n="heart" size={20} />{shortlistCount > 0 && <b className="mx-ct">{shortlistCount}</b>}
      </button>
      {orderCount !== undefined && (
        <button type="button" className="mx-ib" aria-label={t('Orders')} onClick={() => go('orders')}>
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
            <button type="button" className="mx-ib" aria-label={t('Menu')} aria-expanded={menu} onClick={() => setMenu(true)}><Icon n="menu" size={22} /></button>
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
          {nav.slice(0, 1).map((n) => <NavBtn key={n.screen} tab={n.screen} on={currentScreen === n.screen} onClick={() => go(n.screen)}>{t(n.label)}</NavBtn>)}
          {cols.length > 0 && (
            <button type="button" className={`mx-nl${mega ? ' on' : ''}`} aria-expanded={mega} onMouseEnter={() => setMega(true)} onClick={() => setMega((m) => !m)}>{t('Collections')}</button>
          )}
          {nav.slice(1).map((n) => <NavBtn key={n.screen} tab={n.screen} on={currentScreen === n.screen} onClick={() => go(n.screen)}>{t(n.label)}</NavBtn>)}
        </nav>
      )}

      {desk && mega && (
        <div className="mx-mega" data-testid="mx-mega">
          <div className="mx-mega-in">
            <ul>
              {cols.slice(0, 12).map((c) => (
                <li key={c.id}><button type="button" onClick={() => openCol(c.name)}>{hn(c.name, c.nameHi)}</button></li>
              ))}
              <li><button type="button" className="mx-more" onClick={() => go('catalogue')}>{t('All designs')}</button></li>
            </ul>
            <div className="mx-mega-feat">
              {cols.slice(0, 2).map((c, i) => (
                <button key={c.id} type="button" onClick={() => openCol(c.name)}>
                  <span className="mx-mega-ph"><Ph src={c.image} tone={i} className="mx-fill" sizes={SIZES_GRID} alt="" /></span>
                  <span className="mx-ey">{t('Collection')}</span>
                  <span className="mx-cap">{hn(c.name, c.nameHi)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {menu && <MobileMenu nav={nav} cols={cols} current={currentScreen} account={account} onGo={go} onCol={openCol} onClose={() => setMenu(false)} />}
    </header>
  );
};

const NavBtn: React.FC<{ tab: string; on: boolean; onClick: () => void; children: React.ReactNode }> = ({ tab, on, onClick, children }) => (
  <button type="button" data-tab={tab} className={`mx-nl${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>{children}</button>
);

const MobileMenu: React.FC<{ nav: typeof NAV; cols: NonNullable<KitProps<'Header'>['categories']>; current: ActiveScreen; account: React.ReactNode; onGo: (s: ActiveScreen) => void; onCol: (n: string) => void; onClose: () => void }> = ({ nav, cols, current, account, onGo, onCol, onClose }) => {
  useBackLayer(true, onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.documentElement.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="mx-menu" role="dialog" aria-modal="true" aria-label={t('Menu')}>
      <div className="mx-bar">
        <div className="mx-side"><button type="button" className="mx-ib" aria-label={t('Close')} onClick={onClose} autoFocus><Icon n="x" size={22} /></button></div>
        <span className="mx-word"><span>{ts(merchant.brand.name)}</span></span>
        <div className="mx-side r"><LangToggle /></div>
      </div>
      <nav className="mx-menu-l">
        {nav.map((n, i) => (
          <button key={n.screen} type="button" style={{ ['--i' as string]: i }} aria-current={current === n.screen ? 'page' : undefined} onClick={() => onGo(n.screen)}>{t(n.label)}</button>
        ))}
      </nav>
      {cols.length > 0 && (
        <div className="mx-menu-c">
          <div className="mx-ey">{t('Collections')}</div>
          {cols.slice(0, 10).map((c) => <button key={c.id} type="button" onClick={() => onCol(c.name)}>{hn(c.name, c.nameHi)}</button>)}
        </div>
      )}
      <div className="mx-menu-f">{account}</div>
    </div>
  );
};
