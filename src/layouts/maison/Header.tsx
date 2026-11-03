import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { searchDesigns, setOpenTag, useOpenTag } from './TagPage';

const SUB: ActiveScreen[] = ['retailer-auth', 'admin-login'];

/**
 * Maison's masthead. A three-bar button at the left opens the index of tags (a mega-panel on desktop, a full-screen drawer on phones); a tag opens its
 * collection names (no counts) and a collection filters the catalogue. "All designs" lives at the foot of the index, not in the bar. The person icon
 * opens the profile panel, which also holds Shortlist and the order; the count badge (shortlist + order lines) sits on that icon, and each row in the
 * panel shows its own count. Sign-in pages get a back arrow instead. Phones (below 1024px) get PhoneHeader below instead.
 */
export const Header: React.FC<KitProps<'Header'>> = (props) => (useDesktop() ? <DeskHeader {...props} /> : <PhoneHeader {...props} />);

const DeskHeader: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, currentMerchant, onLogout, onOpenOrders, categories = [], shortlistCount = 0, orderCount, onOpenCollection }) => {
  useLang();
  const desk = true;
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

  const badge = shortlistCount + (orderCount ?? 0);
  const account = currentMerchant ? (
    <button type="button" className="mx-ib" data-testid="mx-profile" aria-label="Profile menu" title={t('Profile')} aria-haspopup="dialog" aria-expanded={profile} onClick={() => { setMenu(false); setProfile(true); }}>
      <Icon n="user" size={20} />{badge > 0 && <b className="mx-ct" data-testid="mx-profile-badge" aria-label={String(badge)}>{badge}</b>}
    </button>
  ) : (
    <button type="button" className="mx-ib" aria-label={t('Sign in')} onClick={() => go('retailer-auth')}><Icon n="user" size={20} /></button>
  );
  const counts = (
    <>
      {orderCount !== undefined && (
        <button type="button" className="mx-ib" data-tab="orders" aria-label={t('Orders')} onClick={() => go('orders')}>
          <Icon n="bag" size={20} />
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
      {profile && currentMerchant && (
        <ProfilePanel buyer={currentMerchant} shortlistCount={shortlistCount} orderCount={orderCount ?? 0} onClose={() => setProfile(false)} onOpenOrders={(tab) => { setProfile(false); onOpenOrders(tab); }} onGo={go} onLogout={() => { setProfile(false); onLogout(); }} />
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

/**
 * The phone masthead: the menu (it opens the profile panel; the shortlist and order count sit on it) at the left, the store name in the middle,
 * then search and the bag; on inner pages the bag becomes Back (the app's own Back: a layer first, then out to Home). Over Home's banner and a tag
 * page's banner it floats (clear, a dark gradient behind it, light icons) until most of the banner has scrolled away: one passive scroll listener
 * sets one attribute and CSS fades the rest.
 */
const PhoneHeader: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, currentMerchant, onLogout, onOpenOrders, shortlistCount = 0, orderCount }) => {
  useLang();
  const [profile, setProfile] = useState(false);
  const [searching, setSearching] = useState(false);
  const top = useRef<HTMLElement>(null);
  const openTag = useOpenTag();
  const sub = SUB.includes(currentScreen);
  const home = currentScreen === 'categories';
  const inner = !home || Boolean(openTag);
  useEffect(() => { setProfile(false); setSearching(false); }, [currentScreen, openTag]);

  useLayoutEffect(() => {
    const el = top.current;
    if (!el) return;
    const on = () => {
      const ban = home ? document.querySelector<HTMLElement>('[data-mx-float]') : null;
      el.toggleAttribute('data-float', ban !== null && window.scrollY < ban.offsetHeight * 0.6 - el.offsetHeight);
    };
    on();
    const raf = requestAnimationFrame(on); // again once the new screen has set its scroll position
    window.addEventListener('scroll', on, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); };
  }, [home, openTag]);

  const go = (s: ActiveScreen) => { setProfile(false); setSearching(false); onNavigate(s); };
  const closeSearch = useCallback(() => setSearching(false), []);
  const badge = shortlistCount + (orderCount ?? 0);
  return (
    <header ref={top} className={`mx-top mx-ph${searching ? ' srch' : ''}`}>
      <div className="mx-bar">
        <div className="mx-side">
          {sub ? (
            <button type="button" className="mx-ib" aria-label={t('Back')} onClick={() => onNavigate('welcome')}><Icon n="back" size={22} /></button>
          ) : currentMerchant ? (
            <button type="button" className="mx-ib" data-testid="mx-profile" aria-label={t('Menu')} aria-haspopup="dialog" aria-expanded={profile} onClick={() => { setSearching(false); setProfile(true); }}>
              <Icon n="menu" size={22} />{badge > 0 && <b className="mx-ct" data-testid="mx-profile-badge" aria-label={String(badge)}>{badge}</b>}
            </button>
          ) : (
            <button type="button" className="mx-ib" aria-label={t('Sign in')} onClick={() => go('retailer-auth')}><Icon n="user" size={20} /></button>
          )}
        </div>
        <button type="button" className="mx-word" aria-label={ts(merchant.brand.name)} onClick={() => { setOpenTag(null); go('categories'); }}>
          <BrandMark className="mx-logo" textClassName="text-[18px]" />
          <span>{ts(merchant.brand.name)}</span>
        </button>
        <div className="mx-side r">
          {sub ? <LangToggle /> : (
            <>
              <button type="button" className="mx-ib" data-testid="mx-search" aria-label={t('Search')} aria-expanded={searching} onClick={() => { setProfile(false); setSearching((v) => !v); }}><Icon n="search" size={20} /></button>
              {inner ? (
                <button type="button" className="mx-ib" data-testid="mx-back" aria-label={t('Back')} onClick={() => window.history.back()}><Icon n="back" size={22} /></button>
              ) : orderCount !== undefined && (
                <button type="button" className="mx-ib" data-tab="orders" aria-label={t('Orders')} onClick={() => go('orders')}><Icon n="bag" size={20} /></button>
              )}
            </>
          )}
        </div>
      </div>
      {!sub && <SearchBar open={searching} onClose={closeSearch} onSearch={(q) => { setSearching(false); searchDesigns(q, onNavigate); }} />}
      {profile && currentMerchant && (
        <ProfilePanel buyer={currentMerchant} shortlistCount={shortlistCount} orderCount={orderCount ?? 0} onClose={() => setProfile(false)} onOpenOrders={(tab) => { setProfile(false); onOpenOrders(tab); }} onGo={go} onLogout={() => { setProfile(false); onLogout(); }} />
      )}
    </header>
  );
};

/** The search bar that slides down under the phone masthead. Enter searches the designs (Home's search); Escape, Back, the scrim or the icon again close it. */
const SearchBar: React.FC<{ open: boolean; onClose: () => void; onSearch: (q: string) => void }> = ({ open, onClose, onSearch }) => {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useBackLayer(open, onClose);
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <>
      {open && <button type="button" className="mx-srch-scrim" tabIndex={-1} aria-label={t('Close')} onClick={onClose} />}
      <div className={`mx-srch${open ? ' on' : ''}`} inert={!open || undefined}>
        <form className="mx-srch-in" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
          <Icon n="search" size={18} />
          <input ref={input} type="search" enterKeyHint="search" data-testid="mx-search-input" aria-label={t('Search the catalogue')} placeholder={t('Search name, SKU or collection')} value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>
    </>
  );
};
