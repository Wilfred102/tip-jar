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
  workUrl?: string;
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
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; workId: string; title: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

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

  async function deleteWork(workId: string, title: string) {
    setDeleteModal({ show: true, workId, title });
  }

  async function confirmDelete() {
    if (!deleteModal) return;

    setDeleteModal(null);
    setLoading(true);
    setErrorMessage('');

    try {
      const r = await fetch(`${BACKEND_API_URL}/api/works/${deleteModal.workId}`, {
        method: 'DELETE',
      });
      if (!r.ok) throw new Error('Failed to delete work');

      // Refresh the works list
      await loadWorks();
    } catch (e: any) {
      setErrorMessage('Error deleting work: ' + (e.message || 'Unknown error'));
      console.error('Delete work error:', e);
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
          <div>Creators Works</div>
        </div>
        <div className="actions">
          <Link to="/" className="btn btn-secondary">Home</Link>
          <Link to="/creators" className="btn btn-primary">For creators</Link>
        </div>
      </header>

      {errorMessage && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '16px 0',
          color: '#c33'
        }}>
          <strong>Error:</strong> {errorMessage}
          <button 
            onClick={() => setErrorMessage('')}
            style={{ 
              float: 'right', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#c33'
            }}
          >
            ×
          </button>
        </div>
      )}

      {deleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ 
            maxWidth: '500px', 
            margin: '20px',
            animation: 'fadeIn 0.2s ease-in'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Deletion</h3>
            <p>Are you sure you want to delete <strong>"{deleteModal.title}"</strong>?</p>
            <p style={{ color: '#dc3545', fontSize: '0.875rem' }}>
              This action cannot be undone. The work and its file will be permanently deleted.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteModal(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmDelete}
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <div className="hero-card" style={{ gridColumn: '1 / -1' }}>
          <div className="kicker">Discover Creators</div>
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
            {w.workUrl && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={w.workUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tip-link"
                  style={{ fontSize: '0.875rem' }}
                >
                  🔗 View work link
                </a>
              </div>
            )}
            <div className="actions" style={{ marginTop: 10 }}>
              <Link className="btn btn-primary" to="/app">Tip this creator</Link>
              <button className="btn btn-secondary" onClick={() => navigate(`/works?creatorId=${w.creator._id}`)}>More from creator</button>
              <button
                className="btn btn-secondary"
                onClick={() => deleteWork(w._id, w.title)}
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      <footer className="footer">Powered by your Express + MongoDB backend</footer>
    </div>
  );
}