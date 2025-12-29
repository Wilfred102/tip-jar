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
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function loadCreators() {
    try {
      const r = await fetch(`${BACKEND_API_URL}/api/creators`);
      if (!r.ok) throw new Error('Failed to load creators');
      const j = await r.json();
      setCreators(j || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load creators');
      console.error('Load creators error:', e);
    }
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
    setError('');
    try {
      const r = await fetch(`${BACKEND_API_URL}/api/creators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Failed to create creator');
      await loadCreators();
      (e.currentTarget as HTMLFormElement).reset();
    } catch (e: any) {
      setError(e.message || 'Failed to create creator');
      console.error('Create creator error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function uploadWork(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${BACKEND_API_URL}/api/works`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) throw new Error('Failed to upload work');
      form.reset();
      navigate('/works');
    } catch (e: any) {
      setError(e.message || 'Failed to upload work');
      console.error('Upload work error:', e);
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

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '16px 0',
          color: '#c33'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <section className="hero" style={{ gap: 16 }}>
        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Create An Account</h3>
          <form onSubmit={createCreator}>
            <div className="label">Name</div>
            <input name="name" className="input" required />

            <div className="label" style={{ marginTop: 8 }}>Creator Wallet address (STX)</div>
            <input
              name="walletAddress"
              className="input"
              required
              placeholder="SP..."
              pattern="^(SP|ST)[0-9A-Z]+"
              title="Must be a valid Stacks address starting with SP or ST"
            />

            <div className="label" style={{ marginTop: 8 }}>Avatar URL -  (optional)</div>
            <input
              name="avatarUrl"
              className="input"
              type="url"
              placeholder="https://..."
            />

            <div className="label" style={{ marginTop: 8 }}>Creator Bio (optional)</div>
            <textarea
              name="bio"
              className="input"
              rows={3}
              placeholder="Tell us about yourself and craft..."
            />

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>

        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Upload your work</h3>
          <form onSubmit={uploadWork} encType="multipart/form-data">
            <div className="label">Creator</div>
            <select name="creatorId" className="input" required defaultValue="">
              <option value="" disabled>Select Creator Account</option>
              {creators.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>

            <div className="label" style={{ marginTop: 8 }}>Work Title</div>
            <input
              name="title"
              className="input"
              required
              placeholder="My awesome work"
            />

            <div className="label" style={{ marginTop: 8 }}>Work Description</div>
            <textarea
              name="description"
              className="input"
              rows={3}
              placeholder="Describe your work..."
            />

            <div className="label" style={{ marginTop: 8 }}>Cover URL (optional)</div>
            <input
              name="coverUrl"
              className="input"
              type="url"
              placeholder="https://..."
            />

            <div className="label" style={{ marginTop: 8 }}>Work URL (optional)</div>
            <input
              name="workUrl"
              className="input"
              type="url"
              placeholder="https://... (external link to your work)"
            />

            <div className="label" style={{ marginTop: 8 }}>File</div>
            <input
              name="file"
              className="input"
              type="file"
              required
              accept="audio/*,video/*,image/*,.pdf"
            />

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={loading || creators.length === 0}>
                {loading ? 'Uploading…' : 'Upload'}
              </button>
            </div>

            {creators.length === 0 && (
              <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#666' }}>
                Please create a creator first before uploading works
              </div>
            )}
          </form>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Existing creators</h3>
          {creators.length === 0 && (
            <div className="subtitle">
              No creators yet. Create one using the form above!
            </div>
          )}
          {creators.length > 0 && (
            <ul className="list">
              {creators.map(c => (
                <li key={c._id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #eee'
                }}>
                  <div style={{ flex: 1 }}>
                    {c.avatarUrl && (
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          marginRight: 12,
                          verticalAlign: 'middle'
                        }}
                      />
                    )}
                    <code>
                      <Link
                        to={`/creators/${c._id}`}
                        style={{
                          color: 'inherit',
                          textDecoration: 'none',
                          fontWeight: 600
                        }}
                      >
                        {c.name}
                      </Link>
                    </code>
                    {' '}
                    <span style={{ color: '#666', fontSize: '0.875rem' }}>
                      {c.walletAddress}
                    </span>
                    {c.bio && (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#666',
                        marginTop: 4,
                        marginLeft: c.avatarUrl ? 52 : 0
                      }}>
                        {c.bio}
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/creators/${c._id}`}
                    className="btn btn-secondary"
                    style={{
                      marginLeft: 12,
                      padding: '6px 12px',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    View profile
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">
        Upload works and get tipped on Stacks
      </footer>
    </div>
  );
}