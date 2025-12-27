import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Landing from './pages/Landing';
import { Toaster } from 'sonner';
import { WALLETCONNECT_PROJECT_ID } from './config';
import Creators from './pages/Creators';
import Works from './pages/Works';
import CreatorProfile from './pages/CreatorProfile';

// Reown AppKit (WalletConnect v2)
// Adjust import path if your installed version differs.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createAppKit, AppKitProvider } from '@reown/appkit/react';

// Guarded initialization to avoid runtime errors when the library API/version differs
let appKit: any = null;
try {
  const hasValidProjectId = Boolean(WALLETCONNECT_PROJECT_ID && WALLETCONNECT_PROJECT_ID !== '9610eb1bf7e1fede6d03bb61ae0dfe37');
  if (hasValidProjectId && typeof createAppKit === 'function') {
    appKit = createAppKit({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'STX Tip Jar',
        description: 'Send STX tips on Stacks mainnet',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://example.org',
        icons: [typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : 'https://walletconnect.com/meta/favicon.ico'],
      }
    });
  }
} catch (e) {
  // Swallow init errors and run without AppKit; we can log to console for debugging
  console.warn('Reown AppKit init skipped:', e);
  appKit = null;
}

const AppTree = (
  <BrowserRouter>
    <Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/app" element={<App />} />
  <Route path="/creators" element={<Creators />} />
  <Route path="/creators/:id" element={<CreatorProfile />} />
  <Route path="/works" element={<Works />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
  </BrowserRouter>
);

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Toaster richColors position="top-right" expand={false} duration={3500} />
    {appKit ? (
      <AppKitProvider appKit={appKit}>{AppTree}</AppKitProvider>
    ) : (
      AppTree
    )}
  </React.StrictMode>
);
