import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { merchant } from '../merchant';
import { errorText } from '../bugReport';
import { currentStoreUrl } from '../storeLink';
import { t } from '../i18n';
import { Field, Notice, Segmented, Switch } from './ui';
import { inRoot, useSheet } from './sheetKit';
import { BANGLE_SIZES, RING_SIZES, onService, type Piece, type ServiceAsk } from '../services';
import { RESERVE_HOURS, SHARE_DAYS } from '../../shared/requests';
import type { Product } from '../types';

interface HostProps {
  /** A signed-in buyer: the house already knows who is asking. Visitors of a public store give a name and number. */
  signedIn: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const TIMES = ['11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00'];
const wa = (text: string) => `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(text)}`;

const Frame: React.FC<{ label: string; onClose: () => void; children: React.ReactNode; testId: string }> = ({ label, onClose, children, testId }) => {
  const vars = useSheet(onClose);
  return inRoot(
    <div className="sheet-wrap" style={vars} role="dialog" aria-modal="true" aria-label={label} data-testid={testId}>
      <button type="button" aria-label={t('Close')} className="scrim" onClick={onClose} />
      <div className="sheet mx-form" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <div className="em-row em-sb" style={{ gap: 12 }}>
          <h3 style={{ margin: 0 }}>{label}</h3>
          <button type="button" className="lnk" onClick={onClose}>{t('Close')}</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Pieces: React.FC<{ pieces: Piece[]; onRemove?: (sku: string) => void }> = ({ pieces, onRemove }) =>
  pieces.length === 0 ? null : (
    <div className="col" style={{ gap: 0 }} data-testid="service-pieces">
      {pieces.map((p) => (
        <div key={p.sku} className="em-row" style={{ gap: 12, padding: '8px 0', borderTop: '1px solid var(--em-line, #dedbd6)' }}>
          <img src={p.image} alt="" width={52} height={52} style={{ width: 52, height: 52, objectFit: 'cover', flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0 }}>{p.title}</span>
          {onRemove && <button type="button" className="lnk" aria-label={`Remove ${p.title}`} onClick={() => onRemove(p.sku)}>{t('Remove')}</button>}
        </div>
      ))}
    </div>
  );

/** Name and WhatsApp number, asked only of visitors who are not signed in. */
const Who: React.FC<{ signedIn: boolean; name: string; phone: string; onName: (v: string) => void; onPhone: (v: string) => void }> = ({ signedIn, name, phone, onName, onPhone }) =>
  signedIn ? null : (
    <div className="grid2">
      <Field label={t('Your name')} htmlFor="sv-name"><input id="sv-name" className="inp" autoComplete="name" value={name} onChange={(e) => onName(e.target.value)} maxLength={100} /></Field>
      <Field label={t('WhatsApp number')} htmlFor="sv-phone"><input id="sv-phone" className="inp" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => onPhone(e.target.value)} maxLength={16} /></Field>
    </div>
  );

const Sent: React.FC<{ title: string; text: string; waText: string; onClose: () => void }> = ({ title, text, waText, onClose }) => (
  <div className="col" style={{ gap: 12 }} data-testid="service-sent" role="status">
    <Notice tone="ok">{title}</Notice>
    <p className="hint" style={{ margin: 0 }}>{text}</p>
    <a className="em-btn sec" href={wa(waText)} target="_blank" rel="noopener noreferrer">{t('Message the house on WhatsApp')}</a>
    <button type="button" className="em-btn" onClick={onClose}>{t('Done')}</button>
  </div>
);

/** Shared by the three request forms: sending, the error line and the sent state. */
function useSend() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ expiresAt?: string } | null>(null);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setSent(await api.sendRequest(body));
    } catch (e) {
      setError(errorText(e, 'ServiceSheets send', 'The request could not be sent. Please try again.'));
    }
    setBusy(false);
  };
  return { busy, error, sent, send };
}

const Viewing: React.FC<{ ask: Extract<ServiceAsk, { kind: 'viewing' }>; signedIn: boolean; onClose: () => void }> = ({ ask, signedIn, onClose }) => {
  const [where, setWhere] = useState<'boutique' | 'video'>('boutique');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [occasion, setOccasion] = useState('');
  const [pieces, setPieces] = useState<Piece[]>(ask.pieces ?? []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, error, sent, send } = useSend();
  const ready = date && time && (signedIn || (name.trim() && phone.replace(/\D/g, '').length >= 10));
  const when = `${date} ${time}`;
  return (
    <Frame label={t('Book a private viewing')} onClose={onClose} testId="sheet-viewing">
      {sent ? (
        <Sent title={t('Your request is with the house.')} text={t('The house confirms the time on WhatsApp. Your pieces are laid out before you arrive.')} waText={`Hello ${merchant.brand.name}, I asked for a private viewing on ${when} (${where === 'video' ? 'video call' : 'in the boutique'}).`} onClose={onClose} />
      ) : (
        <>
          <p className="hint" style={{ margin: 0 }}>{t('Your pieces are laid out before you arrive. There is no obligation to buy.')}</p>
          <Field label={t('Where')} htmlFor="sv-where"><Segmented options={[{ key: 'boutique', label: t('In the boutique') }, { key: 'video', label: t('On a video call') }]} value={where} onChange={(k) => setWhere(k as 'boutique' | 'video')} /></Field>
          <div className="grid2">
            <Field label={t('Day')} htmlFor="sv-date"><input id="sv-date" className="inp" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label={t('Time')} htmlFor="sv-time">
              <select id="sv-time" className="inp" value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">{t('Choose')}</option>
                {TIMES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('Occasion, if any')} htmlFor="sv-occ"><input id="sv-occ" className="inp" value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={120} /></Field>
          {pieces.length > 0 && <span className="lab">{t('Pieces to lay out')}</span>}
          <Pieces pieces={pieces} onRemove={(sku) => setPieces(pieces.filter((p) => p.sku !== sku))} />
          <Who signedIn={signedIn} name={name} phone={phone} onName={setName} onPhone={setPhone} />
          {error && <Notice tone="error">{error}</Notice>}
          <button type="button" className="em-btn" data-testid="service-send" disabled={!ready || busy} onClick={() => void send({ kind: 'viewing', where, date, time, occasion: occasion.trim() || undefined, skus: pieces.map((p) => p.sku), ...(signedIn ? {} : { name: name.trim(), phone }) })}>
            {busy ? t('Sending…') : t('Request the viewing')}
          </button>
        </>
      )}
    </Frame>
  );
};

const Chips: React.FC<{ options: string[]; value: string[]; onToggle: (v: string) => void; label: string }> = ({ options, value, onToggle, label }) => (
  <div className="em-row" role="group" aria-label={label} style={{ gap: 8, flexWrap: 'wrap' }}>
    {options.map((o) => (
      <button key={o} type="button" className={`em-btn sec${value.includes(o) ? ' on' : ''}`} aria-pressed={value.includes(o)} onClick={() => onToggle(o)} style={{ minHeight: 44, padding: '6px 14px', fontSize: '0.8125rem', ...(value.includes(o) ? { background: 'var(--mx-ink, var(--em-primary))', color: 'var(--mx-ground, var(--em-on-primary))' } : {}) }}>
        {t(o)}
      </button>
    ))}
  </div>
);

const Bespoke: React.FC<{ ask: Extract<ServiceAsk, { kind: 'bespoke' }>; signedIn: boolean; onClose: () => void }> = ({ ask, signedIn, onClose }) => {
  const [piece, setPiece] = useState('Necklace');
  const [metal, setMetal] = useState('Yellow gold');
  const [stones, setStones] = useState<string[]>([]);
  const [occasion, setOccasion] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [pieces, setPieces] = useState<Piece[]>(ask.pieces ?? []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, error, sent, send } = useSend();
  const ready = signedIn || (name.trim() && phone.replace(/\D/g, '').length >= 10);
  return (
    <Frame label={t('A piece made for you')} onClose={onClose} testId="sheet-bespoke">
      {sent ? (
        <Sent title={t('Your request is with the atelier.')} text={t('You hear back on WhatsApp with a sketch and an estimate. Nothing is made until you approve it.')} waText={`Hello ${merchant.brand.name}, I sent a bespoke request for a ${piece.toLowerCase()}.`} onClose={onClose} />
      ) : (
        <>
          <p className="hint" style={{ margin: 0 }}>{t('Tell us what you have in mind. The atelier answers with a sketch and an estimate. Nothing is made until you approve it.')}</p>
          <span className="lab">{t('The piece')}</span>
          <Chips label={t('The piece')} options={['Ring', 'Necklace', 'Earrings', 'Bangle', 'Full set']} value={[piece]} onToggle={setPiece} />
          <span className="lab">{t('Metal')}</span>
          <Chips label={t('Metal')} options={['Yellow gold', 'White gold', 'Rose gold']} value={[metal]} onToggle={setMetal} />
          <span className="lab">{t('Stones')}</span>
          <Chips label={t('Stones')} options={['Diamonds', 'Rubies', 'Emeralds', 'Pearls', 'Polki']} value={stones} onToggle={(s) => setStones(stones.includes(s) ? stones.filter((x) => x !== s) : [...stones, s])} />
          <div className="grid2">
            <Field label={t('Occasion')} htmlFor="sv-b-occ"><input id="sv-b-occ" className="inp" value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={120} /></Field>
            <Field label={t('Needed by')} htmlFor="sv-b-by"><input id="sv-b-by" className="inp" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} maxLength={40} /></Field>
          </div>
          <Field label={t('Budget, if you wish to share one')} htmlFor="sv-b-bud"><input id="sv-b-bud" className="inp" value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={60} /></Field>
          <Field label={t('Anything else')} htmlFor="sv-b-note"><textarea id="sv-b-note" className="inp" style={{ minHeight: 72 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} /></Field>
          {pieces.length > 0 && <span className="lab">{t('Like these pieces of ours')}</span>}
          <Pieces pieces={pieces} onRemove={(sku) => setPieces(pieces.filter((p) => p.sku !== sku))} />
          <Who signedIn={signedIn} name={name} phone={phone} onName={setName} onPhone={setPhone} />
          {error && <Notice tone="error">{error}</Notice>}
          <button type="button" className="em-btn" data-testid="service-send" disabled={!ready || busy} onClick={() => void send({ kind: 'bespoke', piece, metal, stones, occasion: occasion.trim() || undefined, neededBy: neededBy.trim() || undefined, budget: budget.trim() || undefined, note: note.trim() || undefined, skus: pieces.map((p) => p.sku), ...(signedIn ? {} : { name: name.trim(), phone }) })}>
            {busy ? t('Sending…') : t('Send to the atelier')}
          </button>
        </>
      )}
    </Frame>
  );
};

const Reserve: React.FC<{ ask: Extract<ServiceAsk, { kind: 'reserve' }>; signedIn: boolean; onClose: () => void }> = ({ ask, signedIn, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, error, sent, send } = useSend();
  const ready = signedIn || (name.trim() && phone.replace(/\D/g, '').length >= 10);
  const until = sent?.expiresAt ? new Date(sent.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <Frame label={t('Reserve for {n} hours', { n: RESERVE_HOURS })} onClose={onClose} testId="sheet-reserve">
      {sent ? (
        <Sent title={t('The house has your request to hold this piece.')} text={until ? t('If the house confirms, it is held for you until {when}.', { when: until }) : ''} waText={`Hello ${merchant.brand.name}, I asked to reserve ${ask.piece.title} (${ask.piece.sku}).`} onClose={onClose} />
      ) : (
        <>
          <Pieces pieces={[ask.piece]} />
          <p className="hint" style={{ margin: 0 }}>{t('The house holds this piece for you for {n} hours while you decide. It is a request: the house confirms it on WhatsApp, and there is no payment now.', { n: RESERVE_HOURS })}</p>
          <Who signedIn={signedIn} name={name} phone={phone} onName={setName} onPhone={setPhone} />
          {error && <Notice tone="error">{error}</Notice>}
          <button type="button" className="em-btn" data-testid="service-send" disabled={!ready || busy} onClick={() => void send({ kind: 'reserve', skus: [ask.piece.sku], ...(signedIn ? {} : { name: name.trim(), phone }) })}>
            {busy ? t('Sending…') : t('Ask the house to hold it')}
          </button>
        </>
      )}
    </Frame>
  );
};

const Share: React.FC<{ ask: Extract<ServiceAsk, { kind: 'share' }>; signedIn: boolean; onClose: () => void }> = ({ ask, signedIn, onClose }) => {
  const [note, setNote] = useState(ask.hint ? 'I love this one.' : '');
  const [weights, setWeights] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.createShare(ask.pieces.map((p) => p.sku), note.trim(), weights);
      const base = currentStoreUrl();
      setLink(`${base}${base.includes('?') ? '&' : '/?'}share=${token}`);
    } catch (e) {
      setError(errorText(e, 'ServiceSheets share', 'The link could not be made. Please try again.'));
    }
    setBusy(false);
  };
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError('Could not copy. Press and hold the link to copy it.'); }
  };
  const message = link ? `${note.trim() ? `${note.trim()}\n` : ''}${link}` : '';
  return (
    <Frame label={ask.hint ? t('Drop a hint') : t('Share as a private presentation')} onClose={onClose} testId="sheet-share">
      {!signedIn ? (
        <Notice tone="error">{t('Sign in to share pieces.')}</Notice>
      ) : (
        <>
          <p className="hint" style={{ margin: 0 }}>{ask.hint ? t('Send this piece to someone as one private link. No sign-in is needed to open it, and the link closes after {n} days.', { n: SHARE_DAYS }) : t('One link opens these pieces on a page of their own, with your note. No sign-in is needed, and the link closes after {n} days.', { n: SHARE_DAYS })}</p>
          <Pieces pieces={ask.pieces} />
          {!link && (
            <>
              <Field label={t('Your note')} htmlFor="sv-s-note"><input id="sv-s-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
              <div className="em-row em-sb"><span>{t('Show weights')}</span><Switch on={weights} onChange={() => setWeights(!weights)} label={t('Show weights')} /></div>
              {error && <Notice tone="error">{error}</Notice>}
              <button type="button" className="em-btn" data-testid="share-make" disabled={busy} onClick={() => void make()}>{busy ? t('Making the link…') : t('Make the link')}</button>
            </>
          )}
          {link && (
            <div className="col" style={{ gap: 10 }} data-testid="share-ready">
              <input className="inp" readOnly value={link} aria-label={t('Private link')} data-testid="share-link" onFocus={(e) => e.currentTarget.select()} />
              {error && <Notice tone="error">{error}</Notice>}
              <a className="em-btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">{t('Send on WhatsApp')}</a>
              <button type="button" className="em-btn sec" onClick={() => void copy()}>{copied ? t('Copied') : t('Copy link')}</button>
            </div>
          )}
        </>
      )}
    </Frame>
  );
};

const g = (n?: number) => (typeof n === 'number' ? `${n.toFixed(3)} g` : '–');
const Compare: React.FC<{ pieces: [Product, Product]; onClose: () => void }> = ({ pieces, onClose }) => {
  const rows: Array<[string, (p: Product) => string]> = [
    [t('Collection'), (p) => p.category], [t('Purity'), (p) => p.purity], [t('Gross weight'), (p) => g(p.grossWt)], [t('Stone weight'), (p) => g(p.stoneWt ?? 0)],
    [t('Net weight'), (p) => g(p.netWt)], ['HUID', (p) => p.huid || '–'], [t('Availability'), (p) => t(p.stockStatus)]
  ];
  return (
    <Frame label={t('Side by side')} onClose={onClose} testId="sheet-compare">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, auto) minmax(0, 1fr) minmax(0, 1fr)', columnGap: 12, fontSize: '0.875rem' }}>
        <span />
        {pieces.map((p) => (
          <span key={p.sku} className="col" style={{ gap: 6, paddingBottom: 8 }}>
            <img src={p.image} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }} />
            <b style={{ fontWeight: 600 }}>{p.title}</b>
          </span>
        ))}
        {rows.map(([label, f]) => (
          <React.Fragment key={label}>
            <span className="hint" style={{ padding: '9px 0', borderTop: '1px solid var(--em-line, #dedbd6)', margin: 0 }}>{label}</span>
            {pieces.map((p) => <span key={p.sku} style={{ padding: '9px 0', borderTop: '1px solid var(--em-line, #dedbd6)' }}>{f(p)}</span>)}
          </React.Fragment>
        ))}
      </div>
    </Frame>
  );
};

const Sizes: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Frame label={t('Size guide')} onClose={onClose} testId="sheet-sizes">
    <p className="hint" style={{ margin: 0 }}>{t('Ring: wrap a strip of paper round the finger, mark where it meets and measure the length in millimetres. That length is the circumference. Indian ring size is the circumference less 40.')}</p>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }} data-testid="ring-sizes">
      <thead><tr><th scope="col" style={{ textAlign: 'left', padding: '6px 0' }}>{t('Ring size')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Circumference mm')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Diameter mm')}</th></tr></thead>
      <tbody>
        {RING_SIZES.map((r) => (
          <tr key={r.size} style={{ borderTop: '1px solid var(--em-line, #dedbd6)' }}><td style={{ padding: '6px 0' }}>{r.size}</td><td style={{ textAlign: 'right' }}>{r.circumference}</td><td style={{ textAlign: 'right' }}>{r.diameter.toFixed(1)}</td></tr>
        ))}
      </tbody>
    </table>
    <p className="hint" style={{ margin: 0 }}>{t('Bangle: measure the inner width of a bangle that fits. Sizes are in inches and sixteenths: 2-6 is 2 and 6/16 inches across.')}</p>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }} data-testid="bangle-sizes">
      <thead><tr><th scope="col" style={{ textAlign: 'left', padding: '6px 0' }}>{t('Bangle size')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Inches')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Inner diameter mm')}</th></tr></thead>
      <tbody>
        {BANGLE_SIZES.map((b) => (
          <tr key={b.size} style={{ borderTop: '1px solid var(--em-line, #dedbd6)' }}><td style={{ padding: '6px 0' }}>{b.size}</td><td style={{ textAlign: 'right' }}>{b.inches}</td><td style={{ textAlign: 'right' }}>{b.mm.toFixed(1)}</td></tr>
        ))}
      </tbody>
    </table>
    <p className="hint" style={{ margin: 0 }}>{t('Not sure? Ask the house; a piece can usually be resized.')}</p>
  </Frame>
);

const CARE = [
  'Put jewellery on last, after perfume, lotion and hair spray, and take it off first.',
  'Keep each piece in its own soft pouch or box so pieces do not scratch each other.',
  'Clean gold with lukewarm water, a drop of mild soap and a soft brush; dry with a soft cloth.',
  'Keep pearls, emeralds and polki away from water, heat and chemicals; wipe them with a dry cloth.',
  'Take jewellery off before swimming, the gym and housework.',
  'Have settings checked once a year so no stone works loose.'
];
const Care: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Frame label={t('Care and service')} onClose={onClose} testId="sheet-care">
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9375rem' }}>
      {CARE.map((c) => <li key={c}>{t(c)}</li>)}
    </ul>
    <a className="em-btn sec" href={wa(`Hello ${merchant.brand.name}, I would like to ask about cleaning, resizing or repair.`)} target="_blank" rel="noopener noreferrer">{t('Ask the house about cleaning, resizing or repair')}</a>
  </Frame>
);

/** The one place every service sheet is shown from; mounted once at the app root. */
export const ServiceSheets: React.FC<HostProps> = ({ signedIn }) => {
  const [ask, setAsk] = useState<ServiceAsk | null>(null);
  useEffect(() => onService(setAsk), []);
  if (!ask) return null;
  const close = () => setAsk(null);
  switch (ask.kind) {
    case 'viewing': return <Viewing ask={ask} signedIn={signedIn} onClose={close} />;
    case 'bespoke': return <Bespoke ask={ask} signedIn={signedIn} onClose={close} />;
    case 'reserve': return <Reserve ask={ask} signedIn={signedIn} onClose={close} />;
    case 'share': return <Share ask={ask} signedIn={signedIn} onClose={close} />;
    case 'compare': return <Compare pieces={ask.pieces} onClose={close} />;
    case 'sizes': return <Sizes onClose={close} />;
    case 'care': return <Care onClose={close} />;
  }
};
