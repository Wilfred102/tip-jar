import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BACKEND_API_URL } from '../config';

type Creator = {
  _id: string;
  name: string;
  bio?: string;
  walletAddress: string;
  avatarUrl?: string;
  createdAt?: string;
};

type Work = {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  coverUrl?: string;
  createdAt?: string;
};

type Tip = {
  _id: string;
  creator?: Creator;
  work?: Work;
  amountMicro: string; // stored as string
  senderAddress: string;
  txId: string;
  chain?: string;
  message?: string;
  sentiment?: {
    score: number;
    comparative: number;
    calculation: any[];
    tokens: string[];
    words: string[];
    positive: string[];
    negative: string[];
  };
  createdAt?: string;
};

function microToStx(microStr: string) {
  const m = BigInt(microStr);
  const whole = m / 1000000n;
  const frac = (m % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export default function CreatorProfile() {
  const { id } = useParams<{ id: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; bio: string; walletAddress: string; avatarUrl: string }>({
    name: '', bio: '', walletAddress: '', avatarUrl: ''
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [cRes, wRes, tRes] = await Promise.all([
          fetch(`${BACKEND_API_URL}/api/creators/${id}`),
          fetch(`${BACKEND_API_URL}/api/works?creatorId=${id}`),
          fetch(`${BACKEND_API_URL}/api/tips?creatorId=${id}`),
        ]);
        if (!cRes.ok) throw new Error('Failed to load creator');
        const cJson = await cRes.json();
        const wJson = wRes.ok ? await wRes.json() : [];
        const tJson = tRes.ok ? await tRes.json() : [];
        if (mounted) {
          setCreator(cJson);
          setWorks(wJson || []);
          setTips(tJson || []);
          setForm({
            name: cJson?.name || '',
            bio: cJson?.bio || '',
            walletAddress: cJson?.walletAddress || '',
            avatarUrl: cJson?.avatarUrl || ''
          })
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => { mounted = false; };
  }, [id]);

  const totalTipsStx = useMemo(() => {
    try {
      const sum = tips.reduce((acc, t) => acc + BigInt(t.amountMicro || '0'), 0n);
      return microToStx(sum.toString());
    } catch {
      return '0';
    }
  }, [tips]);

  if (loading) {
    return (
      <div className="container">
        <header className="nav">
          <div className="logo">
            <div className="logo-badge">🧑‍🎨</div>
            <div>Creator</div>
          </div>
          <div className="actions">
            <Link to="/" className="btn btn-secondary">Home</Link>
            <Link to="/creators" className="btn btn-primary">Creators</Link>
          </div>
        </header>
        <div className="card" style={{ marginTop: 24 }}>Loading…</div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="container">
        <header className="nav">
          <div className="logo">
            <div className="logo-badge">🧑‍🎨</div>
            <div>Creator</div>
          </div>
          <div className="actions">
            <Link to="/" className="btn btn-secondary">Home</Link>
            <Link to="/creators" className="btn btn-primary">Creators</Link>
          </div>
        </header>
        <div className="card" style={{ marginTop: 24, color: '#ef4444' }}>{error || 'Creator not found'}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">🧑‍🎨</div>
          <div>{creator.name}</div>
        </div>
        <div className="actions">
          <Link to="/" className="btn btn-secondary">Home</Link>
          <Link to="/creators" className="btn btn-primary">Creators</Link>
        </div>
      </header>

      <section className="hero" style={{ gap: 16 }}>
        <div className="hero-card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt={creator.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}>{creator.name.slice(0, 1)}</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{creator.name}</h2>
            {creator.bio && <p className="subtitle" style={{ margin: '6px 0 0' }}>{creator.bio}</p>}
            <div className="label" style={{ marginTop: 8 }}>Wallet Address</div>
            <code style={{ fontSize: 12 }}>{creator.walletAddress}</code>
          </div>
        </div>

        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Stats</h3>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="card">
              <div className="label">Total Tips</div>
              <div className="value gradient-text">{totalTipsStx} STX</div>
            </div>
            <div className="card">
              <div className="label">Works</div>
              <div className="value">{works.length}</div>
            </div>
            <div className="card">
              <div className="label">Tips</div>
              <div className="value">{tips.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Recent Works</h3>
          {works.length === 0 && <div className="subtitle">No works yet.</div>}
          {works.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
              {works.map(w => (
                <div key={w._id} className="spotlight-card" style={{ overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '16/10', width: '100%', overflow: 'hidden', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }}>
                    <img
                      src={w.coverUrl || w.fileUrl}
                      alt={w.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <h4 style={{ marginBottom: 6 }}>{w.title}</h4>
                  {w.description && <div className="subtitle" style={{ marginTop: 0 }}>{w.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Recent Tips</h3>
          {tips.length === 0 && <div className="subtitle">No tips yet.</div>}
          {tips.length > 0 && (
            <ul className="tips-list">
              {tips.slice(0, 20).map((t) => (
                <li key={t._id} className="tip-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <div className="tip-avatar" title={t.senderAddress}>
                      {t.senderAddress.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="tip-info">
                      <div className="tip-row">
                        <span className="tip-addr">
                          <code title={t.senderAddress}>{t.senderAddress.slice(0, 6)}…{t.senderAddress.slice(-6)}</code>
                        </span>
                        <span className="tip-amount">{microToStx(t.amountMicro)} STX</span>
                      </div>
                      <div className="tip-meta">
                        {t.createdAt && (
                          <span>{new Date(t.createdAt).toLocaleString()}</span>
                        )}
                        {t.txId && (
                          <a className="tip-link" href={`https://explorer.hiro.so/txid/${t.txId}?chain=mainnet`} target="_blank" rel="noreferrer">tx</a>
                        )}
                      </div>
                    </div>
                  </div>
                  {t.message && (
                    <div style={{
                      marginTop: 4,
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      width: '100%',
                      fontSize: '0.9rem',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontStyle: 'italic', color: '#e5e7eb' }}>"{t.message}"</span>
                      {t.sentiment && (
                        <span title={`Sentiment Score: ${t.sentiment.score}`} style={{ fontSize: '1.2rem' }}>
                          {t.sentiment.score > 0 ? '😊' : t.sentiment.score < 0 ? '😔' : '😐'}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">Creator profile</footer>
    </div>
  );
}
