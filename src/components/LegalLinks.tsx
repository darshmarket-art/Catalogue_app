import React from 'react';
import { Capacitor } from '@capacitor/core';
import { legalUrl } from '../storeLink';
import { t, useLang } from '../i18n';

/** Links to the store's Privacy policy and Terms pages (server pages, opened in a new tab). */
export const LegalLinks: React.FC<{ lead?: string; align?: 'center' | 'left' }> = ({ lead, align = 'center' }) => {
  useLang();
  const native = Capacitor.isNativePlatform();
  return (
    <p className="em-hint" data-testid="legal-links" style={{ textAlign: align, margin: 0 }}>
      {lead && <span style={{ display: 'block' }}>{t(lead)}</span>}
      <a href={legalUrl('terms', native)} target="_blank" rel="noopener noreferrer" className="lnk">{t('Terms & conditions')}</a>
      {' · '}
      <a href={legalUrl('privacy', native)} target="_blank" rel="noopener noreferrer" className="lnk">{t('Privacy policy')}</a>
    </p>
  );
};
