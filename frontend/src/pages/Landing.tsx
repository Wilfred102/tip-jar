import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTRACT_ID, BACKEND_API_URL } from '../config';
import { StacksMainnet } from '@stacks/network';
import { callReadOnlyFunction, ClarityValue, cvToJSON, uintCV } from '@stacks/transactions';


function splitContractId(id: string) {
  const [contractAddress, contractName] = id.split('.');
  return { contractAddress, contractName }
}

function microToStxDisplay(micro: string | bigint | number): string {
  const m = typeof micro === 'string' ? BigInt(micro.replace(/^u/, '')) : BigInt(micro);
  const whole = m / 1_000_000n;
  const frac = m % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : `${whole}`;
}

function shortAddr(addr: string, left = 6, right = 6) {
  if (!addr) return '';
  if (addr.length <= left + right + 3) return addr;
  return `${addr.slice(0, left)}...${addr.slice(-right)}`;
}

// FIXED: Corrected timeAgo function with proper TypeScript typing and math
const timeAgo = (ms: number): string => {
  if (!ms) return '';
  const diff = Date.now() - ms;

  const seconds = Math.floor(diff / 1000); // FIXED: was dividing by 100
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`; // FIXED: added "ago"
  return `${days} day${days > 1 ? 's' : ''} ago`; // FIXED: added "ago"
};


export default function Landing() {
  const [recentTips, setRecentTips] = useState<{ sender: string; timestamp: number }[]>([]);
  const [totalTip, setTotalTips] = useState<string>('0');
  const [recentCount, setRecentCount] = useState<number>(0);
  const [topCreators, setTopCreators] = useState<any[]>([]);
  const [stats, setStats] = useState({ highest: 0n, uniqueTippers: 0, avg: 0n });
  const [works, setWorks] = useState<any[]>([]);
  const { contractAddress, contractName } = useMemo(() => splitContractId(CONTRACT_ID), []);
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

      } catch { }
    })()
  }, [contractAddress, contractName, network]);

  useEffect(() => {
    (async () => {
      let foundTips: any[] = [];
      try {
        const base = 'https://api.hiro.so';
        const addr = `${contractAddress}.${contractName}`;

        // Fetch confirmed and mempool in parallel
        // Fetch confirmed and mempool in parallel, handling failures individually
        const results = await Promise.allSettled([
          fetch(`${base}/extended/v1/address/${addr}/transactions?limit=50`, { cache: 'no-store' }),
          fetch(`${base}/extended/v1/address/${addr}/mempool?limit=50`, { cache: 'no-store' })
        ]);

        const txRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const mempoolRes = results[1].status === 'fulfilled' ? results[1].value : null;

        const txData = txRes && txRes.ok ? await txRes.json() : { results: [] };
        const mempoolData = mempoolRes && mempoolRes.ok ? await mempoolRes.json() : { results: [] };

        const allTxs = [...(mempoolData.results || []), ...(txData.results || [])];
        console.log('All Txs:', allTxs.length, allTxs);

        foundTips = allTxs.filter(
          (tx: any) =>
            tx.tx_type === 'contract_call' &&
            (tx.tx_status === 'success' || tx.tx_status === 'pending' || tx.tx_status === 'abort_by_response') &&
            tx.contract_call?.function_name === 'tip'
        );
        console.log('Filtered Tips:', foundTips.length, foundTips);

        if (foundTips.length > 0) {
          setRecentCount(foundTips.length);
          // Compute latest 5 tips
          const sortedTips = foundTips.map((tx: any) => {
            // If pending, use current time
            if (tx.tx_status === 'pending') {
              return {
                sender: tx.sender_address || 'Unknown',
                timestamp: Date.now()
              };
            }

            const s =
              (typeof tx.receipt_time === 'number' && tx.receipt_time) ||
              (typeof tx.block_time === 'number' && tx.block_time) ||
              (typeof tx.burn_block_time === 'number' && tx.burn_block_time) ||
              0;
            return {
              sender: tx.sender_address || 'Unknown',
              timestamp: s ? s * 1000 : Date.now()
            };
          }).sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 5);

          setRecentTips(sortedTips);
          return;
        }
      } catch (e) {
        console.error('API fetch failed', e);
      }

      // Fallback to contract if API failed or returned no tips
      if (foundTips.length === 0) {
        console.log('Using contract fallback');
        const out: any[] = [];
        for (let i = 0; i < 5; i++) {
          try {
            const res = await callReadOnlyFunction({
              contractAddress,
              contractName,
              functionName: 'get-recent-tip',
              functionArgs: [uintCV(i)],
              network,
              senderAddress: contractAddress,
            });
            const json = cvToJSON(res as ClarityValue);
            if ((json as any).type === 'some') {
              const v = (json as any).value.value;
              out.push({
                sender: v.tipper.value,
                timestamp: 0 // Contract doesn't store timestamp
              });
            }
          } catch { }
        }
        setRecentTips(out.reverse());
        setRecentCount(out.length);
      }
    })()
  }, [contractAddress, contractName]);

  useEffect(() => {
    (async () => {
      try {
        const [tipsRes, worksRes] = await Promise.all([
          fetch(`${BACKEND_API_URL}/api/tips`),
          fetch(`${BACKEND_API_URL}/api/works`)
        ]);

        if (tipsRes.ok) {
          const tips = await tipsRes.json();
          // Stats from tips
          const tippers = new Set();
          let maxTip = 0n;
          let totalSum = 0n;

          for (const t of tips) {
            const amt = BigInt(t.amountMicro);
            if (amt > maxTip) maxTip = amt;
            totalSum += amt;
            tippers.add(t.senderAddress);
          }

          setStats({
            highest: maxTip,
            uniqueTippers: tippers.size,
            avg: tips.length ? totalSum / BigInt(tips.length) : 0n
          });
        }

        if (worksRes.ok) {
          const works = await worksRes.json();
          const creatorMap = new Map();

          for (const w of works) {
            const c = w.creator;
            if (c && c._id) {
              if (!creatorMap.has(c._id)) {
                creatorMap.set(c._id, { name: c.name, address: c.walletAddress, count: 0 });
              }
              creatorMap.get(c._id).count++;
            }
          }

          const sortedCreators = Array.from(creatorMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

          setTopCreators(sortedCreators);
          setWorks(works.slice(0, 6)); // Save first 6 works to display
        }

      } catch (e) {
        console.error('Backend fetch failed', e);
      }
    })()
  }, []);

  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">💧</div>
          <div>Tip Jar</div>
        </div>
        <div className="actions">
          <Link to="/creators" className="btn btn-secondary">For creators</Link>
          <Link to="/app" className="btn btn-primary">Get Started</Link>
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
            <a className="btn btn-secondary" href="/works" target="_blank" rel="noreferrer">Browse works</a>

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
          <div className='label'>Latest 200 txs scanned</div>
          <div className='value'>{recentCount}</div>
        </div>
        <div className="card">
          <h3>Last 5 tips</h3>
          <div className="label">Most recent transactions</div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTips.length > 0 ? (
              recentTips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <code style={{ fontSize: 13, color: 'var(--text)' }} title={tip.sender}>
                    {shortAddr(tip.sender)}
                  </code>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {timeAgo(tip.timestamp)}
                  </span>
                </div>
              ))
            ) : (
              <div className="value" style={{ fontSize: 18 }}>—</div>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Top Creators</h3>
          <div className="label">Most prolific</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topCreators.length > 0 ? (
              topCreators.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>#{i + 1}</span>
                    <span>{c.name || shortAddr(c.address)}</span>
                  </div>
                  <span style={{ fontWeight: 'bold' }}>{c.count} works</span>
                </div>
              ))
            ) : (
              <div className="value" style={{ fontSize: 18 }}>—</div>
            )}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Highest Tip</div>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.highest ? microToStxDisplay(stats.highest) : '0'} STX</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Unique Tippers</div>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.uniqueTippers}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Recent Works</h3>
          <div className="label">Latest uploads from creators</div>
          
          {works.length === 0 && (
            <div className="subtitle" style={{ marginTop: 16 }}>No works yet. Be the first to upload!</div>
          )}
          
          {works.length > 0 && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '16px',
              marginTop: '16px'
            }}>
              {works.map((work) => (
                <div 
                  key={work._id} 
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: 'rgba(255,255,255,0.02)'
                  }}
                >
                  {work.coverUrl && (
                    <img 
                      src={work.coverUrl} 
                      alt={work.title}
                      style={{
                        width: '100%',
                        height: '160px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}
                    />
                  )}
                  {!work.coverUrl && work.fileType?.startsWith('image/') && (
                    <img 
                      src={`${BACKEND_API_URL}${work.fileUrl}`} 
                      alt={work.title}
                      style={{
                        width: '100%',
                        height: '160px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}
                    />
                  )}
                  <h4 style={{ margin: '8px 0', fontSize: '1rem' }}>{work.title}</h4>
                  <div style={{ fontSize: '0.875rem', color: '#888', marginBottom: '8px' }}>
                    by {work.creator?.name || 'Unknown'}
                  </div>
                  {work.description && (
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#aaa', 
                      marginBottom: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {work.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link 
                      to="/app" 
                      className="btn btn-primary" 
                      style={{ flex: 1, fontSize: '0.875rem', padding: '8px 12px' }}
                    >
                      Tip
                    </Link>
                    <Link 
                      to="/works" 
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.875rem', padding: '8px 12px' }}
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {works.length > 0 && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Link to="/works" className="btn btn-secondary">
                View all works
              </Link>
            </div>
          )}
        </div>
      </section>

      <footer className="footer">Built with Stacks • WalletConnect enabled</footer>
    </div>
  );
}