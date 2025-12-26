import React, { useEffect, useState } from 'react';
import { BACKEND_API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';

type Creator = {
  _id: string;
  name: string;
  walletAddress: string;
  avatarUrl?: string;
  bio?: string;
};

export default function Creators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function loadCreators() {
    const r = await fetch(`${BACKEND_API_URL}/api/creators`);
    const j = await r.json();
    setCreators(j || []);
  }

  useEffect(() => {
    loadCreators();
  }, []);

  async function createCreator(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get('name'),
      walletAddress: fd.get('walletAddress'),
      bio: fd.get('bio'),
      avatarUrl: fd.get('avatarUrl'),
    };
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_API_URL}/api/creators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Failed to create creator');
      await loadCreators();
      (e.currentTarget as HTMLFormElement).reset();
    } finally {
      setLoading(false);
    }
  }

  async function uploadWork(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_API_URL}/api/works`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) throw new Error('Failed to upload work');
      (e.currentTarget as HTMLFormElement).reset();
      navigate('/works');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">🧑‍🎨</div>
          <div>Creators</div>
        </div>
        <div className="actions">
          <Link to="/" className="btn btn-secondary">Home</Link>
          <Link to="/works" className="btn btn-primary">Browse Works</Link>
        </div>
      </header>

      <section className="hero" style={{ gap: 16 }}>
        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Create creator</h3>
          <form onSubmit={createCreator}>
            <div className="label">Name</div>
            <input name="name" className="input" required />
            <div className="label" style={{ marginTop: 8 }}>Wallet address (STX)</div>
            <input name="walletAddress" className="input" required />
            <div className="label" style={{ marginTop: 8 }}>Avatar URL (optional)</div>
            <input name="avatarUrl" className="input" />
            <div className="label" style={{ marginTop: 8 }}>Bio (optional)</div>
            <textarea name="bio" className="input" rows={3} />
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>

        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Upload a work</h3>
          <form onSubmit={uploadWork} encType="multipart/form-data">
            <div className="label">Creator</div>
            <select name="creatorId" className="input" required defaultValue="">
              <option value="" disabled>Select creator</option>
              {creators.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <div className="label" style={{ marginTop: 8 }}>Title</div>
            <input name="title" className="input" required />
            <div className="label" style={{ marginTop: 8 }}>Description</div>
            <textarea name="description" className="input" rows={3} />
            <div className="label" style={{ marginTop: 8 }}>Cover URL (optional)</div>
            <input name="coverUrl" className="input" />
            <div className="label" style={{ marginTop: 8 }}>File</div>
            <input name="file" className="input" type="file" required />
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Existing creators</h3>
          {creators.length === 0 && <div className="subtitle">No creators yet.</div>}
          {creators.length > 0 && (
            <ul className="list">
              {creators.map(c => (
                <li key={c._id}>
                  <code>{c.name}</code> — <span>{c.walletAddress}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">Upload works and get tipped on Stacks</footer>
    </div>
  );
}