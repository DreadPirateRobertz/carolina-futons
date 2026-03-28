import React from 'react';
<<<<<<< HEAD
import { createRoot } from 'react-dom/client';
import { WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { HookupPanel } from './components/HookupPanel.js';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WixDesignSystemProvider>
      <HookupPanel />
    </WixDesignSystemProvider>
=======
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
>>>>>>> origin/polecat/chrome/CF-3avw@mmvdgu2t
  </React.StrictMode>,
);
