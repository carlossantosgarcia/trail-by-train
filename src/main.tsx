import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readThemePreference } from './lib/themeStorage';
// Tokens first: styles.css and every CSS module reference its custom properties.
import './tokens.css';
import './styles.css';

// index.html already stamped data-theme before first paint. This keeps it
// current if the OS flips while the app is open and the user is on 'auto'.
const osTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
osTheme?.addEventListener('change', () => {
  if (readThemePreference() === 'auto') applyTheme('auto');
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
