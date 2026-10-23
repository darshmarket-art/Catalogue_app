import { usePlan } from '../plan';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion } from '../spring';
import type { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { currentStoreUrl } from '../storeLink';
import { StoreShareSheet } from './StoreShareSheet';
import { t, ts, useLang } from '../i18n';

export interface ProfileUser {
  storeName: string;
  phone: string;
  ownerName?: string;
  gstin?: string;
  marketHub?: string;
}

interface ProfileMenuProps {
  /** The signed-in buyer, or null for staff. */
  buyer: ProfileUser | null;
  isAdmin: boolean;
  onOpenOrders: (tab: 'current' | 'past') => void;
  onOpenAdminConsole: () => void;
  onOpenAbout: () => void;
  onLogout: () => void;
  /** Admin-only entries (share the store, admin accounts, change password) go through here. */
  onNavigate?: (screen: ActiveScreen) => void;
}

const itemClass =
  'w-full flex items-center gap-3 px-5 min-h-[50px] text-left text-[15px] font-semibold text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low border-t border-[rgb(74_24_53/0.07)]';

/** One profile button for everyone who is signed in: buyers and staff share it, so there is a single place to find orders and log out. */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({ buyer, isAdmin, onOpenOrders, onOpenAdminConsole, onOpenAbout, onLogout, onNavigate }) => {
  const orders = usePlan().flags.orders;
  useLang();
  // 'closing' keeps the menu on screen while it shrinks back into the profile button.
  const [menu, setMenu] = useState<'closed' | 'open' | 'closing'>('closed');
  const open = menu === 'open';
  const close = () => setMenu((m) => (m === 'open' ? 'closing' : m));
  const [sharing, setSharing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = buyer?.storeName ?? 'Administrator';

  // The menu grows out of the button at the top right and leaves the same way, so it is clear where it lives.
  // Layout effect: the first frame is already the small, clear one (no flash). Reduced motion: a plain fade.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (menu === 'closed') return;
    if (typeof el?.animate !== 'function') {
      if (menu === 'closing') setMenu('closed');
      return;
    }
    const shut = { opacity: 0, transform: reducedMotion() ? 'none' : 'scale(0.96)' };
    const shown = { opacity: 1, transform: 'none' };
    if (menu === 'open') {
      el.animate([shut, shown], { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      return;
    }
    const exit = el.animate([shown, shut], { duration: 130, easing: 'ease-in', fill: 'forwards' });
    exit.onfinish = () => setMenu('closed');
    // Reopened (or unmounted) mid-exit: stop the exit so it never closes the menu afterwards.
    return () => exit.cancel();
  }, [menu]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    close();
    action();
  };

  const details: Array<[string, string | undefined]> = [
    [t('Owner'), buyer?.ownerName],
    [t('Mobile'), buyer?.phone],
    [t('GST'), buyer?.gstin && buyer.gstin !== 'PENDING-VERIFY' ? buyer.gstin : undefined]
  ];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenu((m) => (m === 'open' ? 'closing' : 'open'))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        title={t('Profile')}
        className="ib"
      >
        <i aria-hidden="true" className="i i-user" />
      </button>

      {menu !== 'closed' && (
        <div
          ref={menuRef}
          className="card absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] !p-0 overflow-hidden z-50"
          style={{ boxShadow: 'var(--sh-2)', transformOrigin: 'top right', pointerEvents: open ? undefined : 'none' }}
        >
          <div className="px-5 pt-4 pb-3">
            <p className="serif text-[21px] leading-tight truncate">{name}</p>
            {isAdmin ? (
              <p className="sub mt-0.5">Administrator</p>
            ) : (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {details.map(([label, value]) =>
                  value ? (
                    <React.Fragment key={label}>
                      <dt className="text-on-surface-variant">{label}</dt>
                      <dd className="text-on-surface font-bold truncate">{value}</dd>
                    </React.Fragment>
                  ) : null
                )}
              </dl>
            )}
          </div>

          <div role="menu" aria-label="Profile">
          {isAdmin ? (
            <>
              <button role="menuitem" className={itemClass} data-testid="menu-store" onClick={choose(onOpenAdminConsole)} type="button">
                Store settings
              </button>
              <button role="menuitem" className={itemClass} data-testid="menu-share-store" onClick={choose(() => setSharing(true))} type="button">
                Share store link / QR
              </button>
              {onNavigate && (
                <button role="menuitem" className={itemClass} data-testid="menu-change-password" onClick={choose(() => onNavigate('admin-password'))} type="button">
                  Change password
                </button>
              )}
            </>
          ) : (
            <>
              {orders && (
                <>
                  <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('current'))} type="button">
                    {t('My order')}
                  </button>
                  <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('past'))} type="button">
                    {t('Past orders')}
                  </button>
                </>
              )}
            </>
          )}

          {!isAdmin && (
            <button role="menuitem" className={itemClass} onClick={choose(onOpenAbout)} type="button">
              {t('About {name}', { name: ts(merchant.brand.name) })}
            </button>
          )}

          {!isAdmin && (
            <button role="menuitem" className={itemClass} data-testid="menu-tour" onClick={choose(() => window.dispatchEvent(new Event('app-tour')))} type="button">
              {t('Take the app tour')}
            </button>
          )}

          <button role="menuitem" className={`${itemClass} !text-error`} onClick={choose(onLogout)} type="button">
            {isAdmin ? 'Log out' : t('Log out')}
          </button>
          </div>
        </div>
      )}
      {sharing && <StoreShareSheet name={merchant.brand.name} url={currentStoreUrl()} onClose={() => setSharing(false)} />}
    </div>
  );
};
