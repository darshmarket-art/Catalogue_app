import React from 'react';
import { Capacitor } from '@capacitor/core';
import { legalUrl } from '../storeLink';
import { t, useLang } from '../i18n';

/** Links to the store's Privacy policy and Terms pages (server pages, opened in a new tab). */
/** `platform` is for the Antarixs site itself (entry page, store sign-up), whose own privacy and terms pages are at /privacy and /terms. */
export const LegalLinks: React.FC<{ lead?: string; align?: 'center' | 'left'; platform?: boolean }> = ({ lead, align = 'center', platform }) => {
  useLang();
  const native = Capacitor.isNativePlatform();
  const href = (page: 'privacy' | 'terms') => (platform ? `/${page}` : legalUrl(page, native));
  return (
    <p className="em-hint" data-testid="legal-links" style={{ textAlign: align, margin: 0 }}>
      {lead && <span style={{ display: 'block' }}>{t(lead)}</span>}
      <a href={href('terms')} target="_blank" rel="noopener noreferrer" className="lnk">{t('Terms & conditions')}</a>
      {' · '}
      <a href={href('privacy')} target="_blank" rel="noopener noreferrer" className="lnk">{t('Privacy policy')}</a>
    </p>
  );
};
