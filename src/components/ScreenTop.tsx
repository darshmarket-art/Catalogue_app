import React from 'react';
import { I } from './ui';

/**
 * The top bar for screens that bring their own title and back button, so they work under every layout
 * (a layout's Header only knows the screens it was built with). Same markup as the Header, so each layout styles it alike.
 */
export const ScreenTop: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <header className="topbar">
    <div className="top">
      <button type="button" className="ib" aria-label="Back" onClick={onBack}>
        <I n="back" />
      </button>
      <h1 style={title.length > 13 ? { fontSize: 24 } : undefined}>{title}</h1>
    </div>
  </header>
);
