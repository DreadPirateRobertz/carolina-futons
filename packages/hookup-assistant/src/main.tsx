import React from 'react';
import { createRoot } from 'react-dom/client';
import { WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { HookupPanel } from './components/HookupPanel.js';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WixDesignSystemProvider>
      <HookupPanel />
    </WixDesignSystemProvider>
  </React.StrictMode>,
);
