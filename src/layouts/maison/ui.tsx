import { Reveal } from '../../components/Reveal';
import React, { useEffect, useRef } from 'react';
import type { Product } from '../../types';
import { useBackLayer } from '../../backLayer';
import { Icon, Ph, fmtG } from '../emergent/ui';
import { getLang, hn, pur, t } from '../../i18n';
import { SIZES_GRID } from '../../photoSrcSet';
import { useDesktop } from '../emergent/useDesktop';

/** A panel that slides in from the right on desktop and up from the bottom on phones (filters, Add to cart). Back and Escape close it. */
export const Drawer: React.FC<{ label: string; onClose: () => void; testId?: string; tall?: boolean; children: React.ReactNode }> = ({ label, onClose, testId, tall, children }) => {
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
    <div className={`mx-drawer-wrap${tall ? " tall" : ""}`} role="dialog" aria-modal="true" aria-label={label} data-testid={testId}>
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

/** Buyer weight on Maison cards and the design page on phones: two decimals (42.50 g); desktop keeps fmtG. The specifications list keeps the stored value (fmtG). */
export const fmtG2 = (n: number) => `${n.toFixed(2)} ${getLang() === 'hi' ? 'ग्राम' : 'g'}`;

/** A tag or collection card on phones: a photo (square on phones), the name in capitals under it, a count under that. The photo element is passed on for the view transition. */
export const Card: React.FC<{ name: string; sub: string; src?: string; tone: number; testId?: string; onOpen: (photo: Element | null) => void }> = ({ name, sub, src, tone, testId, onOpen }) => (
  <Reveal delay={(tone % 2) * 140}>
    <button type="button" className="mx-card" data-testid={testId} onClick={(e) => onOpen(e.currentTarget.querySelector('.em-ph'))}>
      <span className="mx-card-im"><Ph src={src} tone={tone} className="mx-fill" sizes={SIZES_GRID} alt="" /></span>
      <span className="mx-card-nm">{name}</span>
      <span className="mx-card-sub">{sub}</span>
    </button>
  </Reveal>
);

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
  /** Owner screens show the stored weight; buyers see two decimals. */
  exactWt?: boolean;
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

/** A product tile, one card: the photo (ratio --mx-tile-ratio) with the name, purity, weight and code directly under it on the same ground. */
export const Tile: React.FC<TileProps> = ({ prod, index, hearted = false, onOpen, onHeart, onAdd, current, testId = 'product-card', hitTestId, heartLabel, exactWt }) => {
  const name = hn(prod.title, prod.titleHi);
  const desk = useDesktop();
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
      </div>
      <div className="mx-pbody">
        <div className="mx-pcap" onClick={open}>
          <span className="mx-pt">{name}</span>
          <span className="mx-pw"><span>{pur(prod.purity)}</span><b className="mx-wt">{(exactWt || desk ? fmtG : fmtG2)(prod.netWt)}</b></span>
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
