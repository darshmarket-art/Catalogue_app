import React, { useEffect, useRef, useState } from 'react';

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
  onChangePassword: () => void;
  onLogout: () => void;
}

const itemClass =
  'w-full flex items-center gap-2.5 px-4 py-2.5 text-left font-sans text-sm text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none';

/** One profile button for everyone who is signed in: buyers and staff share it, so there is a single place to find orders and log out. */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({ buyer, isAdmin, onOpenOrders, onOpenAdminConsole, onChangePassword, onLogout }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const name = buyer?.storeName ?? 'Staff account';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

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
    ['Owner', buyer?.ownerName],
    ['Mobile', buyer?.phone],
    ['GST', buyer?.gstin && buyer.gstin !== 'PENDING-VERIFY' ? buyer.gstin : undefined],
    ['City / market', buyer?.marketHub]
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
        className="w-10 h-10 rounded-full bg-primary text-white font-serif text-base font-bold flex items-center justify-center border border-primary-container/60 shadow-xs active:scale-95 transition-transform"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-outline-variant/50 overflow-hidden z-50 animate-fade-in"
        >
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/40">
            <p className="font-serif text-[15px] font-bold text-on-surface truncate">{name}</p>
            {isAdmin ? (
              <p className="font-sans text-xs text-outline mt-0.5">Staff</p>
            ) : (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-sans text-xs">
                {details.map(([label, value]) =>
                  value ? (
                    <React.Fragment key={label}>
                      <dt className="text-outline">{label}</dt>
                      <dd className="text-on-surface font-medium truncate">{value}</dd>
                    </React.Fragment>
                  ) : null
                )}
              </dl>
            )}
          </div>

          {isAdmin ? (
            <>
              <button role="menuitem" className={itemClass} onClick={choose(onOpenAdminConsole)} type="button">
                <span className="material-symbols-outlined text-[20px] text-primary">admin_panel_settings</span>
                Admin console
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('current'))} type="button">
                <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
                Placed orders
              </button>
            </>
          ) : (
            <>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('current'))} type="button">
                <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
                My order
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('past'))} type="button">
                <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                Past orders
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(onChangePassword)} type="button">
                <span className="material-symbols-outlined text-[20px] text-primary">lock</span>
                Change password
              </button>
            </>
          )}

          <div className="border-t border-outline-variant/40">
            <button role="menuitem" className={`${itemClass} text-error`} onClick={choose(onLogout)} type="button">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
