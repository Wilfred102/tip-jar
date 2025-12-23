import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">💧</div>
          <div>STX Tip Jar</div>
        </div>
        <div className="actions">
          <Link to="/app" className="btn btn-primary">Enter App</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card" style={{ gridColumn: '1 / -1' }}>
          <div className="kicker">On-chain gratitude for creators</div>
          <h1 className="title">Tip creators on Stacks, instantly</h1>
          <p className="subtitle">
            STX Tip Jar lets anyone send STX tips to a creator using a secure, transparent
            Clarity smart contract on Stacks mainnet. No accounts. No custodians. Just your
            wallet and a simple on-chain tip.
          </p>
          <div className="actions">
            <Link to="/app" className="btn btn-primary">Start tipping</Link>
            <a className="btn btn-secondary" href="https://www.hiro.so/stacks" target="_blank" rel="noreferrer">Learn about Stacks</a>
          </div>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>How it works</h3>
          <ul className="list">
            <li><strong>Smart contract</strong> holds logic: minimum tip, tracking, and routing to creator.</li>
            <li><strong>WalletConnect</strong> lets you approve tips from wallets like Xverse.</li>
            <li><strong>Trustless</strong>: tips are settled on-chain, viewable on the explorer.</li>
          </ul>
        </div>
        <div className="card">
          <h3>Why it’s safe</h3>
          <ul className="list">
            <li><strong>Open source</strong> Clarity code you can audit.</li>
            <li><strong>No custody</strong>: funds go from your wallet directly to the creator.</li>
            <li><strong>Immutable</strong> logic prevents tampering post-deploy.</li>
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
          <p className="subtitle">You’ll connect your wallet on the next page, set an amount, and confirm the transaction.</p>
          <Link to="/app" className="btn btn-primary">Enter App</Link>
        </div>
      </section>

      <footer className="footer">Built with Stacks • WalletConnect enabled</footer>
    </div>
  );
}
