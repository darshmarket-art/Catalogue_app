import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './console.css';
import Console from './Console';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Console />
  </StrictMode>
);
