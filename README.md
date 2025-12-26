STX Tip Jar
A simple, production-minded Stacks app that lets fans tip creators in STX. It showcases:

WalletConnect v2 pairing via Reown AppKit (guarded, optional)
Stacks contract calls via @stacks/connect
Live read-only stats via Hiro API
A modern, responsive UI
Quick links
App page: 
tip-jar/frontend/src/App.tsx
Landing page: 
tip-jar/frontend/src/pages/Landing.tsx
Config: 
tip-jar/frontend/src/config.ts
App entry: 
tip-jar/frontend/src/main.tsx
Styles: 
tip-jar/frontend/src/styles.css
Features
Tip creators on Stacks mainnet using tip() from the tip-jar Clarity contract.
View all-time total tips, recent tips, last tip time, and latest tipper.
Wallet pairing via WalletConnect v2 using Reown AppKit (if configured).
Signing transactions via @stacks/connect.
Read-only stats fetched from Hiro API (no backend required).
Project structure
tip-jar/
  frontend/
    src/
      App.tsx                 # Main tipping UI
      pages/
        Landing.tsx           # Marketing/overview + live stats
      config.ts               # Reads ENV for contract and WalletConnect ID
      main.tsx                # App bootstrap + (guarded) Reown AppKit provider
      styles.css              # Theme styles
    package.json
    tsconfig.json
Prerequisites
Node.js (>=18 recommended)
A WalletConnect Project ID (optional but recommended)
A deployed Stacks tip-jar contract (the default in 
config.ts
 points to a mainnet contract)
Configuration
Set environment variables (recommended via .env in frontend/):

bash
# tip-jar/frontend/.env
VITE_CONTRACT_ID=SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.tip-jar
VITE_WALLETCONNECT_PROJECT_ID=YOUR_WC_PROJECT_ID
Notes:

VITE_CONTRACT_ID must match the contract that implements get-total-tips, get-recent-tip, and tip.
VITE_WALLETCONNECT_PROJECT_ID enables WalletConnect v2 pairing. If omitted, the app runs without the Reown modal.
src/config.ts
 falls back to defaults if ENV is not set:

CONTRACT_ID: defaults to SP2A8V...F4ZB.tip-jar
WALLETCONNECT_PROJECT_ID: defaults to a known test value; replace with your own for production
Install and run (frontend)
bash
cd tip-jar/frontend
npm install
npm run dev
Open http://localhost:5173 (or the port Vite prints).

How it works
src/App.tsx
Uses @stacks/connect to:
Open a wallet connect modal (showConnect) to set connected state.
Call the smart contract function tip via openContractCall.
Reads on-chain data:
get-total-tips (read-only function) to display aggregate total.
Recent tips:
Prefer Hiro API (/extended/v1/address/.../transactions) for richer metadata (per-tx timestamps).
Falls back to a ring buffer-like read (get-recent-tip) if API fails.
Recent tips are sorted by a numeric timestamp to avoid identical times.
src/pages/Landing.tsx
Brand stats:
All-time total tips (on-chain).
Recent tips count (from Hiro API, latest 50).
Time of the last tip (per-tx receipt time if available).
Latest tipper (address of the most recent sender).
Uses the same CONTRACT_ID and Hiro API.
src/main.tsx
Guarded Reown AppKit initialization using WALLETCONNECT_PROJECT_ID.
Wraps app in AppKitProvider only when AppKit init succeeds—avoids runtime crashes with mismatched versions.
WalletConnect vs signing
Pairing (WalletConnect v2 modal): via Reown AppKit, opened by a UI button (when enabled).
Signing transactions: via @stacks/connect (showConnect, openContractCall). If a WC session exists with a compatible wallet, signing should route there.
Known behaviors and tips
Total tips not updating immediately:
A tx is first broadcast, then confirmed and indexed. The app refresh runs after broadcast; to guarantee the latest total, add a small confirmation poll (see below).
Leather wallet failures:
Ensure Leather network is Mainnet; the app uses StacksMainnet.
Tip amount must meet the contract’s minimum (e.g., 0.1 STX). Use a clean decimal (0.1, 0.2, 1.0).
If a tx fails, check its explorer page for the abort reason.
Optional: ensure totals update post-confirmation
Consider adding a confirmation wait after openContractCall({ onFinish }):

ts
async function waitForTxSuccess(txid: string, maxMs = 120000, intervalMs = 3000) {
  const start = Date.now();
  const url = `https://api.hiro.so/extended/v1/tx/${txid}`;
  while (true) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        if (j?.tx_status === 'success') return;
        if (j?.tx_status === 'abort_by_response' || j?.tx_status === 'failed') throw new Error('failed');
      }
    } catch { /* ignore */ }
    if (Date.now() - start > maxMs) return; // give up; periodic refresh will catch up
    await new Promise(res => setTimeout(res, intervalMs));
  }
}
Use in 
onFinish
:

ts
onFinish: async (data: any) => {
  if (data?.txId) await waitForTxSuccess(data.txId);
  await refresh(); // now totals reflect the mined tx
}
Styling
The app uses a custom theme defined in 
src/styles.css
 and some inline styles in 
App.tsx
 for enhanced visuals.
Common classes: container, nav, hero, hero-card, grid, card, btn, value, subtitle, etc.
Troubleshooting
“Cannot read properties of undefined (reading 'map')” in 
main.tsx
:
Your Reown AppKit version may not support certain options. The code guards init and removes optional unsupported keys.
Reown modal not opening:
Ensure the correct import path for your installed @reown/appkit version (e.g., @reown/appkit/react vs @reown/appkit).
Ensure VITE_WALLETCONNECT_PROJECT_ID is set to a real project ID.
Recent tips all show the same time:
We sort by a numeric receipt-time (timeMs) and prefer per-tx timestamps to avoid block-level identical times.
Scripts (frontend)
From tip-jar/frontend/:

npm run dev – Start Vite dev server
npm run build – Build for production
npm run preview – Preview production build
Tech stack
React + TypeScript + Vite
Stacks libraries: @stacks/connect, @stacks/transactions, @stacks/network
WalletConnect v2 via Reown AppKit (optional, guarded)
Hiro API for blockchain data (no backend required)
Security
Never commit private keys or secrets.
Do not hardcode API keys in the code; use .env.
In production, consider rate-limiting and caching for Hiro API requests.
License
MIT. See LICENSE if provided.

If you want me to tailor the README to a different contract or add a section about the Clarity code itself (functions, constraints, events), share the contract source and I’ll include it.