import React from 'react';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { LangToggle } from '../../components/LangToggle';
import { LegalLinks } from '../../components/LegalLinks';
import { type KitProps } from '../emergent/ui';
import { t, tl, ts, useLang } from '../../i18n';

/** Maison's first screen: the house's name set large and thin on black, one way in, and the store's promises as numbered columns. */
export const Welcome: React.FC<KitProps<'Welcome'>> = ({ onNavigate }) => {
  useLang();
  const feats = merchant.welcome.features;
  return (
    <div className="mx-welcome">
      <div className="mx-w-lang"><LangToggle onDark /></div>
      <section className="mx-w-hero">
        <span className="mx-w-mark mx-rise" style={{ ['--d' as string]: '0ms' }}><BrandMark className="w-10 h-10" textClassName="text-[28px]" /></span>
        <span className="mx-ey mx-rise" style={{ ['--d' as string]: '120ms' }}>{ts(merchant.brand.tagline)}</span>
        <h1 className="mx-display mx-rise" style={{ ['--d' as string]: '220ms' }}>{ts(merchant.brand.name)}</h1>
        <p className="mx-lede mx-rise" style={{ ['--d' as string]: '360ms' }}>{tl(merchant.brand.description)}</p>
        <button type="button" className="mx-btn lt mx-rise" style={{ ['--d' as string]: '480ms' }} onClick={() => onNavigate('retailer-auth')}>{t('Enter the portal')}</button>
        <small className="mx-note mx-rise" style={{ ['--d' as string]: '560ms' }}>{t('For registered buyers. Sign in with your WhatsApp number.')}</small>
      </section>
      {feats.length > 0 && (
        <ol className="mx-w-feats">
          {feats.map((f, i) => (
            <li key={f.title} className="mx-rise" style={{ ['--d' as string]: `${640 + i * 90}ms` }}>
              <span className="mx-num">{String(i + 1).padStart(2, '0')}</span>
              <b>{ts(f.title)}</b>
              <span>{tl(f.description)}</span>
            </li>
          ))}
        </ol>
      )}
      <footer className="mx-w-foot">
        <PoweredByAntarixs />
        {tl(merchant.welcome.footerLine) && <span>{tl(merchant.welcome.footerLine)}</span>}
        {tl(merchant.legal.registrationLine) && <span>{tl(merchant.legal.registrationLine)}</span>}
        <LegalLinks />
      </footer>
    </div>
  );
};
