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
  onOpenAbout: () => void;
  onLogout: () => void;
}

const itemClass =
  'w-full flex items-center gap-3 px-5 min-h-[52px] text-left font-sans text-[15.5px] font-bold text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low border-t border-outline-variant';

/** One profile button for everyone who is signed in: buyers and staff share it, so there is a single place to find orders and log out. */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({ buyer, isAdmin, onOpenOrders, onOpenAdminConsole, onChangePassword, onOpenAbout, onLogout }) => {
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
        className="w-11 h-11 rounded-full bg-primary text-on-primary font-sans text-lg font-extrabold flex items-center justify-center active:scale-95 transition-transform"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-3xl shadow-[0_14px_40px_rgba(30,10,24,0.28)] border border-outline-variant overflow-hidden z-50 animate-fade-in"
        >
          <div className="px-5 pt-4 pb-3">
            <p className="font-serif text-[21px] text-primary leading-tight truncate">{name}</p>
            {isAdmin ? (
              <p className="font-sans text-sm text-on-surface-variant mt-0.5">Staff</p>
            ) : (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-sans text-sm">
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
              <button role="menuitem" className={itemClass} onClick={choose(onOpenAdminConsole)} type="button">
                Admin console
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('current'))} type="button">
                Placed orders
              </button>
            </>
          ) : (
            <>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('current'))} type="button">
                My order
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(() => onOpenOrders('past'))} type="button">
                Past orders
              </button>
              <button role="menuitem" className={itemClass} onClick={choose(onChangePassword)} type="button">
                Change password
              </button>
            </>
          )}

          <button role="menuitem" className={itemClass} onClick={choose(onOpenAbout)} type="button">
            About us
          </button>

          <button role="menuitem" className={`${itemClass} text-error`} onClick={choose(onLogout)} type="button">
            Log out
          </button>
        </div>
      )}
    </div>
  );
};
