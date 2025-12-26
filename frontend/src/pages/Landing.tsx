import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTRACT_ID } from '../config';
import { StacksMainnet } from '@stacks/network';
import { callReadOnlyFunction, ClarityValue, cvToJSON } from '@stacks/transactions';


function splitContractId(id: string) {
  const [contractAddress, contractName]  = id.split('.');
  return { contractAddress, contractName}
}

function microToStxDisplay(micro: string | bigint): string {
  const m = typeof micro === 'string' ? BigInt(micro.replace(/^u/, '')) : micro;
  const whole = m / 1_000_000n;
  const frac = m % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : `${whole}`;
}


export default function Landing() {
  const [totalTip, setTotalTips] = useState<string>('u0');
  const [recentCount, setRecentCount] = useState<number>(0);
  const [lastTipMs, setLastTipMs] = useState<number | null>(null);
  const {contractAddress, contractName } = useMemo(() => splitContractId(CONTRACT_ID), []);
  const network = useMemo(() => new StacksMainnet(), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await callReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-total-tips',
          functionArgs: [],
          network,
          senderAddress: contractAddress,
        });
        const json = cvToJSON(res as ClarityValue);
        setTotalTips((json as any).value as string);

      } catch {}
    })()
  }, [contractAddress, contractName, network]);

  useEffect(() => {
    (async () => {
      try {
        const url = `https://api.hiro.so/extended/v1/address/${contractAddress}.${contractName}/transactions?limit=50`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`API ${r.status}`);
        const data = await r.json();
        const tips = (data.results || []).filter(
          (tx: any) =>
            tx.tx_type === 'contract_call' &&
            tx.tx_status === 'success' &&
            tx.contract_call?.function_name === 'tip'
          );
          setRecentCount(tips.length);
          const latestSeconds = tips.reduce((acc: number, tx: any) => {
            const s =
            (typeof tx.receipt_time === 'number' && tx.receipt_time) ||
            (typeof tx.block_time === 'number' && tx.block_time) ||
            (typeof tx.burn_block_time === 'number' && tx.burn_block_time) ||
            0;
            return Math.max(acc, s);
          }, 0);
          setLastTipMs(latestSeconds ? latestSeconds * 1000 : null);
      } catch { }
    })()
  }, [contractAddress, contractName]);
  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">💧</div>
          <div>STX Tip Jar</div>
        </div>
        <div className="actions">
          <a href="#creators" className="btn btn-secondary">For creators</a>
          <Link to="/app" className="btn btn-primary">Enter App</Link>
        </div>
      </header>

      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Ambient aurora background */}
        <div className="aurora aurora-1" aria-hidden="true" />
        <div className="aurora aurora-2" aria-hidden="true" />
        <div className="aurora aurora-3" aria-hidden="true" />

        <div className="hero-card" style={{ gridColumn: '1 / -1' }}>
          <div className="kicker">A home for music & art</div>
          <h1 className="title gradient-text">Fuel the creators who move you</h1>
          <p className="subtitle">
            Tip musicians, visual artists, filmmakers, designers, streamers and more — directly on
            Stacks mainnet. Transparent, non-custodial, and instant. Your support, their freedom.
          </p>
          <div className="actions">
            <Link to="/app" className="btn btn-primary btn-glow">Start tipping</Link>
            <a className="btn btn-secondary" href="https://www.hiro.so/stacks" target="_blank" rel="noreferrer">Learn about Stacks</a>
          </div>

          {/* Creative tag marquee */}
          <div className="marquee" style={{ marginTop: 20 }}>
            <div className="marquee-track">
              {['beats', 'visual art', 'live coding', 'indie film', 'street art', 'photography', '3D', 'podcasts', 'streaming', 'poetry', 'generative', 'dance', 'sound design', 'illustration'].map((tag) => (
                <span key={tag} className="marquee-item pill">{tag}</span>
              ))}
              {['beats', 'visual art', 'live coding', 'indie film', 'street art', 'photography', '3D', 'podcasts', 'streaming', 'poetry', 'generative', 'dance', 'sound design', 'illustration'].map((tag) => (
                <span key={tag + '-dup'} className="marquee-item pill">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Creator spotlights */}
      <section id="creators" className="grid" style={{ marginTop: 24 }}>
        <div className="spotlight-card">
          <div className="emoji-badge">🎵</div>
          <h3>Music makers</h3>
          <p className="subtitle">Producers, vocalists, DJs and sound designers receiving direct, on-chain support.</p>
          <Link to="/app" className="btn btn-secondary">Tip a musician</Link>
        </div>
        <div className="spotlight-card">
          <div className="emoji-badge">🎨</div>
          <h3>Visual artists</h3>
          <p className="subtitle">Illustrators, painters, street artists, 3D and generative creators — no middlemen.</p>
          <Link to="/app" className="btn btn-secondary">Tip an artist</Link>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>How it works</h3>
          <ul className="list">
            <li>🔐 <strong>Smart contract</strong> holds logic: minimum tip, tracking and routing.</li>
            <li>🔗 <strong>WalletConnect</strong> lets you approve tips from wallets like Xverse.</li>
            <li>🔎 <strong>Transparent</strong>: tips are settled on-chain, viewable on the explorer.</li>
          </ul>
        </div>
        <div className="card">
          <h3>Why creators love it</h3>
          <ul className="list">
            <li>👐 <strong>No custody</strong>: funds go from your wallet directly to the creator.</li>
            <li>🧩 <strong>Composable</strong>: easy to embed in bios, link-in-bio, websites, streams.</li>
            <li>🛡️ <strong>Open-source</strong> Clarity you can audit.</li>
          </ul>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Features</h3>
          <ul className="list">
            <li><strong>Read-only stats</strong> show total tips and latest tippers.</li>
            <li><strong>Minimum tip</strong> enforced to prevent dust spam.</li>
            <li><strong>Explorer links</strong> for full transparency.</li>
          </ul>
        </div>
        <div className="card">
          <h3>Get started</h3>
          <p className="subtitle">Connect your wallet on the next page, set an amount and confirm the transaction.</p>
          <Link to="/app" className="btn btn-primary btn-glow">Enter App</Link>
        </div>
      </section>
      <section className='grid' style={{ marginTop: 16 }}>
         <div className='card'>
          <h3>All-time tipped</h3>
          <div className='label'>Total tips across the protocol</div>
             <div className='value gradient-text'>{microToStxDisplay(totalTip)} STX</div> 
         </div>
         <div className='card'>
          <h3>Recent Tips</h3>
           <div className='label'>Latest 50 txs scanned</div>
         </div>
      </section>

      <footer className="footer">Built with Stacks • WalletConnect enabled</footer>
    </div>
  );
}
