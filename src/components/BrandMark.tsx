import React, { useState } from 'react';
import { merchant } from '../merchant';

interface BrandMarkProps {
  /** Size classes for the image (and the fallback letter's box). */
  className: string;
  /** Font size classes for the fallback letter. */
  textClassName: string;
}

/** The merchant's emblem; shows the brand's first letter if the logo is missing or fails to load. */
export const BrandMark: React.FC<BrandMarkProps> = ({ className, textClassName }) => {
  const [failed, setFailed] = useState(false);

  if (!merchant.brand.logoUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className={`${className} ${textClassName} flex items-center justify-center font-serif font-bold leading-none text-primary-fixed-dim`}
      >
        {merchant.brand.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      alt={`${merchant.brand.name} Emblem`}
      className={`${className} object-contain`}
      src={merchant.brand.logoUrl}
      onError={() => setFailed(true)}
    />
  );
};
