import React from 'react';
import { merchant } from '../../merchant';
import { LegalLinks } from '../../components/LegalLinks';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { Reveal } from '../../components/Reveal';
import { type KitProps } from '../emergent/ui';
import { hl, hn, t, tl, ts, useLang } from '../../i18n';
import { reportProblem } from '../../bugReport';

/** Maison About: the name large, the story as a lede, details as a hairline list, and contact as uppercase text links. Same data rules as Emergent's About. */
export const About: React.FC<KitProps<'About'>> = ({ about }) => {
  useLang();
  const phone = about.phone || merchant.contact.deskPhone;
  const mapAddress = about.mapPin || merchant.contact.mapPin || about.address || merchant.contact.address;
  const address = about.address ? hl(about.address, about.addressHi) || ts(about.address) : ts(merchant.contact.address);
  const digits = phone.replace(/[^0-9+]/g, '');
  const story = about.story ? hl(about.story, about.storyHi) : tl(merchant.brand.description);

  const actions = [
    { label: t('WhatsApp us'), href: `https://wa.me/${merchant.contact.whatsapp}` },
    { label: t('Call'), href: `tel:${digits}` },
    ...(about.email ? [{ label: t('Email'), href: `mailto:${about.email}` }] : []),
    ...(mapAddress ? [{ label: t('Map'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}` }] : []),
    ...(about.website ? [{ label: t('Website'), href: about.website }] : []),
    ...(about.instagram ? [{ label: 'Instagram', href: about.instagram }] : []),
    ...(about.facebook ? [{ label: 'Facebook', href: about.facebook }] : [])
  ];
  const details: Array<[string, string | undefined]> = [
    [t('Owner'), about.ownerName ? `${ts(about.ownerName)}${about.ownerRole ? `, ${hn(about.ownerRole, about.ownerRoleHi)}` : ''}` : undefined],
    [t('Phone'), phone],
    [t('Email'), about.email],
    [t('Hours'), about.openingHours ? hl(about.openingHours, about.openingHoursHi) || ts(about.openingHours) : undefined],
    [t('Address'), address],
    [t('GST'), about.gstin || undefined],
    [t('Registration'), tl(merchant.legal.registrationLine) || undefined]
  ];

  return (
    <div className="mx-about">
      <section className="mx-ab-head">
        <span className="mx-ey">{t('About the house')}</span>
        <h1 className="mx-display">{ts(merchant.brand.name)}</h1>
        <span className="mx-ey">{ts(merchant.brand.tagline)}</span>
      </section>
      <div className="mx-ab-body">
        <Reveal><p className="mx-lede" style={{ whiteSpace: 'pre-line' }}>{story}</p></Reveal>
        <div>
          {merchant.welcome.features.length > 0 && (
            <ol className="mx-w-feats in">
              {merchant.welcome.features.map((f, i) => (
                <li key={f.title}><span className="mx-num">{String(i + 1).padStart(2, '0')}</span><b>{ts(f.title)}</b><span>{tl(f.description)}</span></li>
              ))}
            </ol>
          )}
          <dl className="mx-dl">
            {details.map(([label, value]) => value ? (<div key={label}><dt className="mx-ey">{label}</dt><dd>{value}</dd></div>) : null)}
          </dl>
          <ul className="mx-links">
            {actions.map((a) => <li key={a.label}><a href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{a.label}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="mx-report-wrap"><ReportProblem /></div>
      <div className="mx-foot-b"><PoweredByAntarixs /><span className="mx-note">{window.location.hostname}</span><LegalLinks /></div>
    </div>
  );
};

/** Something looked wrong but nothing failed (so nothing reported itself): a note goes to Bug reports with the steps that led here. */
export const ReportProblem: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [sent, setSent] = React.useState(false);
  if (sent) return <p className="mx-note mx-center-note">{t('Thank you, we have it.')}</p>;
  if (!open) {
    return (
      <button type="button" className="mx-cta" data-testid="report-problem" onClick={() => setOpen(true)}>
        {t('Report a problem')}
      </button>
    );
  }
  return (
    <div className="mx-report">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t('What went wrong?')} aria-label={t('Report a problem')} />
      <button
        type="button"
        className="mx-btn sec sm"
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
