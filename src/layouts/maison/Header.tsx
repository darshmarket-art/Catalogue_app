import React, { useEffect, useState } from 'react';
import type { ActiveScreen } from '../../types';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { LangToggle } from '../../components/LangToggle';
import { Icon, type KitProps } from '../emergent/ui';
import { useDesktop } from '../emergent/useDesktop';
import { useBackLayer } from '../../backLayer';
import { hn, t, ts, useLang } from '../../i18n';
import { groupByTag, useTagList } from '../../tagList';
import { ProfilePanel } from './Profile';

const SUB: ActiveScreen[] = ['retailer-auth', 'admin-login'];

/**
 * Maison's masthead. A three-bar button at the left opens the index of tags (a mega-panel on desktop, a full-screen drawer on phones); a tag opens its
 * collection names (no counts) and a collection filters the catalogue. "All designs" lives at the foot of the index, not in the bar. The person icon
 * opens the profile panel. Sign-in pages get a back arrow instead.
 */
export const Header: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, currentMerchant, onLogout, onOpenOrders, categories = [], shortlistCount = 0, orderCount, onOpenCollection }) => {
  useLang();
  const desk = useDesktop();
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const sub = SUB.includes(currentScreen);
  useEffect(() => { setMenu(false); setProfile(false); }, [currentScreen]);
  useEffect(() => {
    if (!menu || !desk) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [menu, desk]);

  const go = (s: ActiveScreen) => { setMenu(false); setProfile(false); onNavigate(s); };
  const openCol = (name: string) => { setMenu(false); onOpenCollection?.(name); };
  const tagOrder = useTagList();
  const groups = groupByTag(categories.filter((c) => c.designCount > 0).sort((a, b) => b.designCount - a.designCount), tagOrder);

  const account = currentMerchant ? (
    <button type="button" className="mx-ib" data-testid="mx-profile" aria-label="Profile menu" title={t('Profile')} aria-haspopup="dialog" aria-expanded={profile} onClick={() => { setMenu(false); setProfile(true); }}>
      <Icon n="user" size={20} />
    </button>
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
    <header className={`mx-top${menu ? ' open' : ''}`}>
      <div className="mx-bar">
        <div className="mx-side">
          {sub ? (
            <button type="button" className="mx-ib" aria-label={t('Back')} onClick={() => onNavigate('welcome')}><Icon n="back" size={22} /></button>
          ) : (
            <button type="button" className="mx-ib mx-burger" data-testid="mx-menu" aria-label={t('Browse by type')} aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Icon n={menu && desk ? 'x' : 'menu'} size={22} />
            </button>
          )}
          {desk && !sub && <LangToggle />}
        </div>
        {word}
        <div className="mx-side r">
          {!sub && counts}
          {!sub && account}
          {sub && !desk && <LangToggle />}
        </div>
      </div>

      {desk && !sub && (
        <nav className="mx-nav" aria-label="Main">
          <NavBtn tab="categories" on={currentScreen === 'categories'} onClick={() => go('categories')}>{t('Home')}</NavBtn>
          <NavBtn tab="about" on={currentScreen === 'about'} onClick={() => go('about')}>{t('About us')}</NavBtn>
        </nav>
      )}

      {desk && menu && (
        <>
          <button type="button" className="mx-mega-scrim" tabIndex={-1} aria-label={t('Close')} onClick={() => setMenu(false)} />
          <div className="mx-mega" data-testid="mx-mega" role="dialog" aria-label={t('Browse by type')}>
            <div className="mx-mega-in"><TagIndex groups={groups} desk onCol={openCol} onAll={() => go('catalogue')} /></div>
          </div>
        </>
      )}
      {!desk && menu && <MobileMenu groups={groups} current={currentScreen} onGo={go} onCol={openCol} onClose={() => setMenu(false)} />}
      {profile && currentMerchant && (
        <ProfilePanel buyer={currentMerchant} onClose={() => setProfile(false)} onOpenOrders={(tab) => { setProfile(false); onOpenOrders(tab); }} onGo={go} onLogout={() => { setProfile(false); onLogout(); }} />
      )}
    </header>
  );
};

const NavBtn: React.FC<{ tab: string; on: boolean; onClick: () => void; children: React.ReactNode }> = ({ tab, on, onClick, children }) => (
  <button type="button" data-tab={tab} className={`mx-nl${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>{children}</button>
);

type Groups = ReturnType<typeof groupByTag<NonNullable<KitProps<'Header'>['categories']>[number]>>;

/**
 * The index of all tags (Rings, Necklaces ...). Choosing a tag shows that tag's collection names, no counts. Desktop: tags in a column on the left,
 * the open tag's collections on the right. Phones: an accordion, one tag open at a time.
 */
const TagIndex: React.FC<{ groups: Groups; desk?: boolean; onCol: (n: string) => void; onAll: () => void }> = ({ groups, desk, onCol, onAll }) => {
  const [open, setOpen] = useState<string | null>(desk ? groups[0]?.[0] ?? null : null);
  const cols = (cs: Groups[number][1]) => (
    <ul className="mx-tix-cols">
      {cs.map((c) => <li key={c.id}><button type="button" onClick={() => onCol(c.name)}>{hn(c.name, c.nameHi)}</button></li>)}
    </ul>
  );
  const active = groups.find(([tag]) => tag === open);
  return (
    <div className={`mx-tix${desk ? ' desk' : ''}`}>
      <ul className="mx-tix-tags">
        {groups.map(([tag, cs], i) => {
          const on = tag === open;
          return (
            <li key={tag} className={on ? 'on' : ''} style={{ ['--i' as string]: i }}>
              <button type="button" className="mx-tix-tag" aria-expanded={on} onMouseEnter={desk ? () => setOpen(tag) : undefined} onClick={() => setOpen(desk ? tag : on ? null : tag)}>
                <span>{tag}</span><Icon n={desk ? 'next' : on ? 'up' : 'chev'} size={16} />
              </button>
              {!desk && on && cols(cs)}
            </li>
          );
        })}
      </ul>
      {desk && active && <div className="mx-tix-panel" key={active[0]}><h3 className="mx-tix-h">{active[0]}</h3>{cols(active[1])}</div>}
      <button type="button" className="mx-cta mx-all" data-testid="mx-all-designs" onClick={onAll}>{t('View all designs')}</button>
    </div>
  );
};

const MobileMenu: React.FC<{ groups: Groups; current: ActiveScreen; onGo: (s: ActiveScreen) => void; onCol: (n: string) => void; onClose: () => void }> = ({ groups, current, onGo, onCol, onClose }) => {
  useBackLayer(true, onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.documentElement.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="mx-menu" role="dialog" aria-modal="true" aria-label={t('Browse by type')}>
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
          <button type="button" aria-current={current === 'categories' ? 'page' : undefined} onClick={() => onGo('categories')}>{t('Home')}</button>
          <button type="button" aria-current={current === 'about' ? 'page' : undefined} onClick={() => onGo('about')}>{t('About us')}</button>
        </nav>
      </div>
    </div>
  );
};
