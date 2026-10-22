import React, { useEffect, useState } from 'react';
import { Icon, Sheet } from './layouts/emergent/ui';
import { t } from './i18n';

/*
 * In-app feedback instead of the browser's alert() and confirm() boxes: a short notice under the header that the person can close,
 * and a confirm sheet whose buttons say what they do (Cancel, Delete). <NoticeHost /> is mounted once by App.
 */
type Ask = { message: string; confirm: string; resolve: (ok: boolean) => void };
let showNote: ((message: string) => void) | null = null;
let showAsk: ((ask: Ask) => void) | null = null;

/** A message for the person, shown in the app (falls back to alert() only if no host is mounted). */
export const notify = (message: string) => (showNote ? showNote(message) : window.alert(message));

/** Asks before something that cannot be undone; resolves true when the person chose the destructive button. */
export const confirmDelete = (message: string, confirm = 'Delete'): Promise<boolean> =>
  new Promise((resolve) => (showAsk ? showAsk({ message, confirm, resolve }) : resolve(window.confirm(message))));

export const NoticeHost: React.FC = () => {
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    showNote = (text) => setNote({ id: Date.now(), text });
    showAsk = setAsk;
    return () => {
      showNote = null;
      showAsk = null;
    };
  }, []);
  // Long enough to read (about 8 s for a sentence); it can also be closed straight away.
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), Math.max(6000, note.text.length * 90));
    return () => clearTimeout(timer);
  }, [note]);

  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  return (
    <>
      {note && (
        <div key={note.id} role="alert" className="em-toast em-note">
          <span>{note.text}</span>
          <button type="button" className="em-note-x" aria-label={t('Close')} onClick={() => setNote(null)}>
            <Icon n="x" size={16} />
          </button>
        </div>
      )}
      {ask && (
        <Sheet label={ask.message} onClose={() => answer(false)}>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: '4px 0 18px' }}>{ask.message}</p>
          <div className="em-row" style={{ gap: 10 }}>
            <button type="button" className="em-btn sec" style={{ flex: 1 }} onClick={() => answer(false)}>
              {t('Cancel')}
            </button>
            <button type="button" className="em-btn danger" style={{ flex: 1 }} onClick={() => answer(true)}>
              {ask.confirm}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
};
