import { usePlan } from '../plan';
import React, { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const name = buyer?.storeName ?? 'Administrator';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
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
    setOpen(false);
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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        title={t('Profile')}
        className="ib"
      >
        <i aria-hidden="true" className="i i-user" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile"
          className="card absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] !p-0 overflow-hidden z-50 animate-fade-in" style={{ boxShadow: "var(--sh-2)" }}
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
      )}
      {sharing && <StoreShareSheet name={merchant.brand.name} url={currentStoreUrl()} onClose={() => setSharing(false)} />}
    </div>
  );
};
