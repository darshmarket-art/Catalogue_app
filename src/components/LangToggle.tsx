import React from 'react';
import { Languages } from 'lucide-react';
import { setLang, useLang } from '../i18n';

/** English / हिन्दी switch for buyers: a small two-way pill with the language icon. The choice is remembered on this device. */
export const LangToggle: React.FC<{ onDark?: boolean }> = ({ onDark }) => {
  const lang = useLang();
  return (
    <div className={`em-lang${onDark ? ' dk' : ''}`} role="group" aria-label="Language / भाषा" data-testid="lang-toggle">
      <Languages size={15} aria-hidden="true" />
      <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : ''} data-testid="lang-en" onClick={() => setLang('en')} lang="en">
        EN
      </button>
      <button type="button" aria-pressed={lang === 'hi'} className={lang === 'hi' ? 'on' : ''} data-testid="lang-hi" onClick={() => setLang('hi')} lang="hi">
        हि
      </button>
    </div>
  );
};
