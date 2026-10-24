import React from 'react';
import { merchant } from '../../merchant';
import { LegalLinks } from '../../components/LegalLinks';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { Icon, type KitProps } from './ui';
import { hl, hn, t, tl, ts, useLang } from '../../i18n';
import { reportProblem } from '../../bugReport';

/** "About us" (atlas About): a hero under the top bar, then the store's details as icon rows. Anything the owner leaves empty falls back to the merchant's own details, or is hidden. */
export const About: React.FC<KitProps<'About'>> = ({ about }) => {
  useLang();
  const phone = about.phone || merchant.contact.deskPhone;
  // The exact spot picked on Google Maps when there is one, else the address text.
  const mapAddress = about.mapPin || merchant.contact.mapPin || about.address || merchant.contact.address;
  const address = about.address ? hl(about.address, about.addressHi) || ts(about.address) : ts(merchant.contact.address);
  const digits = phone.replace(/[^0-9+]/g, '');
  const story = about.story ? hl(about.story, about.storyHi) : tl(merchant.brand.description);

  const actions = [
    { label: t('Call'), href: `tel:${digits}`, icon: 'phone' },
    ...(about.email ? [{ label: t('Email'), href: `mailto:${about.email}`, icon: 'mail' }] : []),
    ...(mapAddress ? [{ label: t('Map'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`, icon: 'pin' }] : []),
    ...(about.website ? [{ label: t('Website'), href: about.website, icon: 'globe' }] : [])
  ];

  const details: Array<[string, string, string | undefined]> = [
    ['user', t('Owner'), about.ownerName ? `${ts(about.ownerName)}${about.ownerRole ? `, ${hn(about.ownerRole, about.ownerRoleHi)}` : ''}` : undefined],
    ['phone', t('Phone'), phone],
    ['mail', t('Email'), about.email],
    ['clock', t('Hours'), about.openingHours ? hl(about.openingHours, about.openingHoursHi) || ts(about.openingHours) : undefined],
    ['pin', t('Address'), address],
    ['file', t('GST'), about.gstin || undefined],
    ['shield', t('Registration'), tl(merchant.legal.registrationLine) || undefined]
  ];

  return (
    <div className="em-page notabs em-about" style={{ paddingTop: 0 }}>
      <section className="em-hero about">
        <div className="em-ey g">{t('About the house')}</div>
        <h1 className="em-ser" style={{ fontSize: '2.0625rem', lineHeight: 1.2, marginTop: 8, color: 'var(--em-on-primary)' }}>
          {ts(merchant.brand.name)}
        </h1>
        <p style={{ fontSize: '0.8125rem', opacity: 0.75, margin: '6px 0 0' }}>{ts(merchant.brand.tagline)}</p>
      </section>

      <div className="em-pad em-ab" style={{ paddingTop: 20 }}>
        <div className="em-ab-story">
        <div className="em-rule" />
        <p className="em-mut" style={{ fontSize: '0.875rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
          {story}
        </p>
        </div>

        {merchant.welcome.features.length > 0 && (
          <section className="em-dk em-ab-promises" aria-label={t('Our promises')}>
            {merchant.welcome.features.map((f) => (
              <div key={f.title} className="em-card em-ab-promise">
                <span className="em-ico">
                  <span className="material-symbols-outlined">{f.icon}</span>
                </span>
                <b>{ts(f.title)}</b>
                <span className="em-hint">{tl(f.description)}</span>
              </div>
            ))}
          </section>
        )}

        <div className="em-ab-details" style={{ marginTop: 22 }}>
          {details.map(([icon, label, value]) =>
            value ? (
              <div key={label} className="em-feature">
                <span className="em-ico">
                  <Icon n={icon} size={16} />
                </span>
                <div className="em-grow">
                  <div className="em-ey">{label}</div>
                  <div style={{ marginTop: 2, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{value}</div>
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="em-ab-actions" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a className="em-btn wa" href={`https://wa.me/${merchant.contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <Icon n="wa" />
            {t('WhatsApp us')}
          </a>
          <div className="em-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {actions.map((a) => (
              <a key={a.label} className="em-btn sec sm" href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                <Icon n={a.icon} size={15} />
                {a.label}
              </a>
            ))}
          </div>
        </div>
        <ReportProblem />
        <div className="em-ab-foot" style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <PoweredByAntarixs />
          <span className="em-hint">{window.location.hostname}</span>
          <LegalLinks />
        </div>
      </div>
    </div>
  );
};

/** Something looked wrong but nothing failed (so nothing reported itself): a note goes to Bug reports with the steps that led here. */
const ReportProblem: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [sent, setSent] = React.useState(false);
  if (sent) return <p className="em-hint" style={{ marginTop: 24, textAlign: 'center' }}>{t('Thank you, we have it.')}</p>;
  if (!open) {
    return (
      <button type="button" className="em-link" data-testid="report-problem" style={{ marginTop: 24, alignSelf: 'center' }} onClick={() => setOpen(true)}>
        {t('Report a problem')}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t('What went wrong?')} aria-label={t('Report a problem')} style={{ width: '100%' }} />
      <button
        type="button"
        className="em-btn sec sm"
        disabled={note.trim().length < 3}
        onClick={() => {
          reportProblem(note.trim());
          setSent(true);
        }}
      >
        {t('Send')}
      </button>
    </div>
  );
};
