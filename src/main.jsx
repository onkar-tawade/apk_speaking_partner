import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { applyPersistedSettings } from './services/settingsStore';
import './index.css';

applyPersistedSettings();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal - the app still works fully without it, just won't be
      // "installable" as a home-screen app in some browsers.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
