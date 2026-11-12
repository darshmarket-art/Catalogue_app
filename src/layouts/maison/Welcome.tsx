import React from 'react';
import { coverSrc, merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { LangToggle } from '../../components/LangToggle';
import { LegalLinks } from '../../components/LegalLinks';
import { Icon, type KitProps } from '../emergent/ui';
import { t, tl, ts, useLang } from '../../i18n';

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` });

/**
 * Maison's first screen, before anyone signs in. The first screenful is the house and nothing else: its mark, its name set large, a hairline,
 * its line, and one way in, over the owner's Welcome photo when one is set (Store settings; it is the only photograph a signed-out visitor sees).
 * The store's promises wait below the fold as numbered lines.
 */
export const Welcome: React.FC<KitProps<'Welcome'>> = ({ onNavigate }) => {
  useLang();
  const feats = merchant.welcome.features;
  const cover = coverSrc();
  const tagline = ts(merchant.brand.tagline);
  const about = tl(merchant.brand.description);
  return (
    <div className={`mx-welcome${cover ? ' has-cover' : ''}`} data-testid="mx-welcome">
      <section className="mx-w-hero">
        {cover && <div className="mx-w-cover" aria-hidden="true"><img src={cover} alt="" decoding="async" fetchPriority="high" /></div>}
        <div className="mx-w-lang"><LangToggle onDark /></div>
        <div className="mx-w-brand">
          <span className="mx-w-mark mx-rise" style={d(0)}><BrandMark className="mx-w-logo" textClassName="mx-w-letter" /></span>
          <h1 className="mx-display mx-rise" style={d(140)} data-testid="mx-welcome-name">{ts(merchant.brand.name)}</h1>
          <i className="mx-w-rule" aria-hidden="true" />
          {tagline && <span className="mx-ey mx-rise" style={d(420)}>{tagline}</span>}
          {about && <p className="mx-lede mx-rise" style={d(520)}>{about}</p>}
        </div>
        <div className="mx-w-enter mx-rise" style={d(680)}>
          <button type="button" className="mx-btn mx-w-go" data-testid="welcome-enter" onClick={() => onNavigate('retailer-auth')}>
            <span>{t('Enter the portal')}</span><Icon n="right" size={16} />
          </button>
          <small className="mx-note">{t('For registered buyers. Sign in with your WhatsApp number.')}</small>
        </div>
      </section>
      {feats.length > 0 && (
        <ol className="mx-w-feats">
          {feats.map((f, i) => (
            <li key={f.title}>
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
