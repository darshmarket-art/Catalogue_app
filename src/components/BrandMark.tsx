import React, { useEffect, useState } from 'react';
import { logoSrc, merchant } from '../merchant';

interface BrandMarkProps {
  /** Size classes for the image (and the fallback letter's box). */
  className: string;
  /** Font size classes for the fallback letter. */
  textClassName: string;
}

/** The merchant's emblem; shows the brand's first letter if the logo is missing or fails to load. Follows a new upload at once. */
export const BrandMark: React.FC<BrandMarkProps> = ({ className, textClassName }) => {
  const [src, setSrc] = useState(logoSrc);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const on = () => {
      setSrc(logoSrc());
      setFailed(false);
    };
    window.addEventListener('brand-logo', on);
    return () => window.removeEventListener('brand-logo', on);
  }, []);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`${className} ${textClassName} flex items-center justify-center font-serif font-bold leading-none text-tertiary-fixed-dim`}
      >
        {merchant.brand.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return <img alt={`${merchant.brand.name} Emblem`} className={`${className} object-contain`} src={src} onError={() => setFailed(true)} />;
};
