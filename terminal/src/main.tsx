import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useTerminalStore } from './store/useTerminalStore';
import { useLayoutStore } from './store/useLayoutStore';
import { useDrawingStore } from './store/useDrawingStore';

if (typeof window !== 'undefined') {
  (window as any).__terminalStore = useTerminalStore;
  (window as any).__layoutStore = useLayoutStore;
  (window as any).__drawingStore = useDrawingStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
