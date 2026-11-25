import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useTerminalStore } from './store/useTerminalStore';
import { useLayoutStore } from './store/useLayoutStore';
import { useDrawingStore } from './store/useDrawingStore';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__terminalStore = useTerminalStore;
  (window as any).__layoutStore = useLayoutStore;
  (window as any).__drawingStore = useDrawingStore;
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
