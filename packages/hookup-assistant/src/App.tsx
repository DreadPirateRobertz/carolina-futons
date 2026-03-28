/**
 * App root — wraps HookupPanel with Wix SDK providers.
 *
 * When running outside the Wix editor iframe (e.g. during local testing
 * without the editor), `editor.host()` may be unavailable. The providers
 * are applied unconditionally; any SDK calls that require an editor context
 * will simply return null/undefined in standalone mode.
 */

import { WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { HookupPanel } from './components/HookupPanel.js';

export function App() {
  return (
    <WixDesignSystemProvider>
      <HookupPanel />
    </WixDesignSystemProvider>
  );
}
