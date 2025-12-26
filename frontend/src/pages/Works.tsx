import React, { useEffect, useState } from 'react';
import { BACKEND_API_URL } from '../config';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

type Creator = { _id: string; name: string; walletAddress: string; avatarUrl?: string; };
type Work = {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  coverUrl?: string;
  creator: Creator;
};

function shortAddr(addr: string, left = 6, right = 6) {
  if (!addr) return '';
  if (addr.length <= left + right + 3) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export default function Works() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  async function loadWorks() {
    setLoading(true);
    try {
      const creatorId = params.get('creatorId');
      const query = creatorId ? `?creatorId=${encodeURIComponent(creatorId)}` : '';
      const r = await fetch(`${BACKEND_API_URL}/api/works${query}`);
      const j = await r.json();
      setWorks(j || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWorks(); }, [params]);

  function renderMedia(w: Work) {
    if (w.fileType.startsWith('image/')) {
      return <img src={`${BACKEND_API_URL}${w.fileUrl}`} alt={w.title} style={{ width: '100%', borderRadius: 8 }} />;
    }
    if (w.fileType.startsWith('audio/')) {
      return <audio controls src={`${BACKEND_API_URL}${w.fileUrl}`} style={{ width: '100%' }} />;
    }
    if (w.fileType.startsWith('video/')) {
      return <video controls src={`${BACKEND_API_URL}${w.fileUrl}`} style={{ width: '100%', borderRadius: 8 }} />;
    }
    return (
      <a className="tip-link" href={`${BACKEND_API_URL}${w.fileUrl}`} target="_blank" rel="noreferrer">
        Download file
      </a>
    );
  }

  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">🖼️</div>
          <div>Works</div>
        </div>
        <div className="actions">
          <Link to="/" className="btn btn-secondary">Home</Link>
          <Link to="/creators" className="btn btn-primary">For creators</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card" style={{ gridColumn: '1 / -1' }}>
          <div className="kicker">Discover</div>
          <h1 className="title">Support creators</h1>
          <p className="subtitle">Browse recent uploads and tip creators directly on Stacks mainnet.</p>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        {loading && <div className="card"><div className="subtitle">Loading…</div></div>}
        {!loading && works.length === 0 && (
          <div className="card"><div className="subtitle">No works yet.</div></div>
        )}
        {!loading && works.map(w => (
          <div key={w._id} className="card">
            <h3 style={{ marginTop: 0 }}>{w.title}</h3>
            <div className="label">By</div>
            <div style={{ marginBottom: 8 }}>
              <code title={w.creator.walletAddress}>{w.creator.name}</code>
              {' · '}
              <span title={w.creator.walletAddress}>{shortAddr(w.creator.walletAddress)}</span>
            </div>
            <div style={{ marginBottom: 8 }}>{renderMedia(w)}</div>
            {w.description && <p className="subtitle" style={{ marginTop: 8 }}>{w.description}</p>}
            <div className="actions" style={{ marginTop: 10 }}>
              <Link className="btn btn-primary" to="/app">Tip this creator</Link>
              <button className="btn btn-secondary" onClick={() => navigate(`/works?creatorId=${w.creator._id}`)}>More from creator</button>
            </div>
          </div>
        ))}
      </section>

      <footer className="footer">Powered by your Express + MongoDB backend</footer>
    </div>
  );
}