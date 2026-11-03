import React, { useEffect, useRef } from 'react';
import type { Product } from '../../types';
import { useBackLayer } from '../../backLayer';
import { Icon, Ph, fmtG } from '../emergent/ui';
import { hn, pur, t } from '../../i18n';
import { SIZES_GRID } from '../../photoSrcSet';

/** A panel that slides in from the right on desktop and up from the bottom on phones (filters, Add to cart). Back and Escape close it. */
export const Drawer: React.FC<{ label: string; onClose: () => void; testId?: string; children: React.ReactNode }> = ({ label, onClose, testId, children }) => {
  useBackLayer(true, onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    window.addEventListener('keydown', k, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', k, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="mx-drawer-wrap" role="dialog" aria-modal="true" aria-label={label} data-testid={testId}>
      <button type="button" className="mx-scrim" tabIndex={-1} aria-label={t('Close')} onClick={onClose} />
      <div className="mx-drawer">
        <div className="mx-drawer-h">
          <span className="mx-ey">{label}</span>
          <button ref={closeRef} type="button" className="mx-ib" data-testid="mx-drawer-close" aria-label={t('Close')} onClick={onClose}>
            <Icon n="x" size={20} />
          </button>
        </div>
        <div className="mx-drawer-b">{children}</div>
      </div>
    </div>
  );
};

interface TileProps {
  prod: Product;
  index: number;
  hearted?: boolean;
  /** Open the design; the photo element is passed so the view transition can fly it to the design page. */
  onOpen: (photo: Element | null) => void;
  onHeart?: () => void;
  onAdd?: () => void;
  current?: boolean;
  testId?: string;
  hitTestId?: string;
  heartLabel?: string;
}

/** Tilts a tile toward the pointer in 3D (mouse only; CSS reads --rx/--ry). No re-render: it only writes two custom properties. */
const tilt = {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 10}deg`);
    el.style.setProperty('--rx', `${-(((e.clientY - r.top) / r.height) - 0.5) * 10}deg`);
  },
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.removeProperty('--rx'); e.currentTarget.style.removeProperty('--ry'); }
};

/** A product tile, Bulgari style: the photo fills the square and the name, purity, weight and code sit inside it along the foot. */
export const Tile: React.FC<TileProps> = ({ prod, index, hearted = false, onOpen, onHeart, onAdd, current, testId = 'product-card', hitTestId, heartLabel }) => {
  const name = hn(prod.title, prod.titleHi);
  const open = (e: React.MouseEvent<HTMLElement>) => onOpen(e.currentTarget.closest('.mx-ptile')?.querySelector('.em-ph') ?? null);
  return (
    <article className={`mx-ptile${current ? ' current' : ''}`} style={{ ['--i' as string]: index }} data-sku={prod.sku} data-testid={testId} {...tilt}>
      <div className="mx-pframe">
        <button type="button" className="mx-hit" data-testid={hitTestId} aria-label={t('View {name}', { name })} onClick={open}>
          <Ph src={prod.image} tone={index} className="mx-fill" sizes={SIZES_GRID} alt={name} />
        </button>
        {onHeart && (
          <button type="button" className={`mx-heart${hearted ? ' on' : ''}`} aria-pressed={hearted} aria-label={heartLabel ?? t(hearted ? 'Remove {name} from shortlist' : 'Add {name} to shortlist', { name })} onClick={onHeart}>
            <Icon n="heart" size={18} fill={hearted} />
          </button>
        )}
        <div className="mx-pcap" onClick={open}>
          <span className="mx-pt">{name}</span>
          <span className="mx-pw">{pur(prod.purity)} · {fmtG(prod.netWt)}<span className="mx-sku"> · {prod.sku}</span></span>
        </div>
        {onAdd && (
          <button type="button" className="mx-cta" data-testid="card-add-to-cart" aria-label={t('Add {name} to cart', { name })} onClick={onAdd}>
            {t('Add to cart')}
          </button>
        )}
      </div>
    </article>
  );
};
