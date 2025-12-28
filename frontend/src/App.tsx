import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StacksMainnet } from '@stacks/network';
import { openContractCall, showConnect, UserSession } from '@stacks/connect';
import { callReadOnlyFunction, ClarityValue, cvToJSON, uintCV } from '@stacks/transactions';
import Monitor from './pages/Monitor';
import { CONTRACT_ID as CONFIG_CONTRACT_ID, WALLETCONNECT_PROJECT_ID as CONFIG_WALLETCONNECT_PROJECT_ID } from './config';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

// const CONTRACT_ID = 'SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.tip-jar';
const CONTRACT_ID = CONFIG_CONTRACT_ID;
// const WALLETCONNECT_PROJECT_ID = '9610eb1bf7e1fede6d03bb61ae0dfe37';
const WALLETCONNECT_PROJECT_ID = CONFIG_WALLETCONNECT_PROJECT_ID;
const network = new StacksMainnet();

function splitContractId(id: string) {
  const [contractAddress, contractName] = id.split('.');
  return { contractAddress, contractName };
}

function parseStxToMicro(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*(?:\.|\,)??\d*$/.test(trimmed)) return 0n;
  const [whole, fracRaw = ''] = trimmed.replace(',', '.').split('.');
  const frac = (fracRaw + '000000').slice(0, 6);
  const w = whole === '' ? '0' : whole;
  const microStr = `${w}${frac}`.replace(/^0+(?=\d)/, '');
  return microStr === '' ? 0n : BigInt(microStr);
}

function microToStxDisplay(micro: string | bigint): string {
  const m = typeof micro === 'string' ? BigInt(micro.replace(/^u/, '')) : micro;
  const whole = m / 1000000n;
  const frac = m % 1000000n;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : `${whole}`;
}

function shortAddr(addr: string, left = 6, right = 6) {
  if (addr.length <= left + right + 3) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

type RecentTip = {
  index?: number;
  tipper: string;
  amountMicro: string;
  timeIso?: string;
  txid?: string;
  timeMs?: number;
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [amountStx, setAmountStx] = useState('0.1');
  const [totalTips, setTotalTips] = useState<string>('u0');
  const [recent, setRecent] = useState<RecentTip[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [wcModalOpen, setWcModalOpen] = useState(false);
  const { contractAddress, contractName } = useMemo(() => splitContractId(CONTRACT_ID), []);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const openWalletConnectModal = useCallback(() => {
    setWcModalOpen(true);
    toast('WalletConnect modal opened');
  }, []);

  const closeWalletConnectModal = useCallback(() => {
    setWcModalOpen(false);
  }, []);

  const connect = useCallback(() => {
    toast('Connecting wallet...');
    showConnect({
      userSession: new UserSession({ appConfig: undefined as any }),
      appDetails: { name: 'STX Tip Jar', icon: window.location.origin + '/favicon.ico' },
      onFinish: () => {
        setConnected(true);
        toast('Wallet connected');
      },
      onCancel: () => {
        toast('Connection canceled')
      },
      walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
      network,
    } as any);
  }, []);

  const fetchTotal = useCallback(async () => {
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
  }, [contractAddress, contractName]);

  const fetchRecentViaApi = useCallback(async () => {
    const base = 'https://api.hiro.so';
    const url = `${base}/extended/v1/address/${contractAddress}.${contractName}/transactions?limit=50`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    const items = (data.results || [])
      .filter((tx: any) =>
        tx.tx_type === 'contract_call' &&
        tx.tx_status === 'success' &&
        tx.contract_call?.function_name === 'tip'
      )
      .map((tx: any) => {
        const arg = tx.contract_call?.function_args?.[0];
        const repr: string = arg?.repr || 'u0';
        const amountMicro = repr.startsWith('u') ? repr.slice(1) : repr;

        const seconds =
          (typeof tx.receipt_time === 'number' ? tx.receipt_time : null) ??
          (typeof tx.block_time === 'number' ? tx.block_time : null) ??
          (typeof tx.burn_block_time === 'number' ? tx.burn_block_time : null) ??
          0;

        const timeMs = seconds ? seconds * 1000 : Date.now();

        return {
          tipper: tx.sender_address as string,
          amountMicro,
          timeIso: tx.burn_block_time_iso || tx.receipt_time_iso || '',
          txid: tx.tx_id,
          timeMs,
        } as RecentTip;
      });

    items.sort((a: any, b: any) => b.timeMs - a.timeMs);

    // If API returns empty, we don't throw, just set empty. 
    // If the user wants fallback to contract, we could throw, but API is usually source of truth for history.
    // However, to be safe and allow fallback if API finds nothing (e.g. indexing delay), we can check:
    if (items.length === 0) {
      // Optional: throw to trigger fallback if we really trust contract more for "latest"
      // But usually API is better. Let's stick to API if it returns success.
      // throw new Error('no recent item'); 
    }
    setRecent(items);
  }, [contractAddress, contractName]);

  const fetchRecent = useCallback(async () => {
    try {
      await fetchRecentViaApi();
      return;
    } catch (e) {
      console.warn('API fetch failed, using fallback:', e);
    }
    const out: RecentTip[] = [];
    for (let i = 0; i < 5; i++) {
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
          index: i,
          tipper: v.tipper.value,
          amountMicro: v.amount.value
        });
      }
    }
    setRecent(out);
  }, [contractAddress, contractName, fetchRecentViaApi]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchTotal(), fetchRecent()]);
  }, [fetchTotal, fetchRecent]);

  const tipsHourly24 = useMemo(() => {
    const now = Date.now();
    const buckets: { label: string; stx: number; count: number }[] = [];
    const toStx = (micro: string) => Number(BigInt(micro)) / 1_000_000;
    for (let i = 23; i >= 0; i--) {
      const end = now - i * 3600_000;
      const start = end - 3600_000;
      let stx = 0, count = 0;
      for (const t of recent) {
        const ts = typeof t.timeMs === 'number' && t.timeMs > 0
          ? t.timeMs
          : (t.timeIso ? Date.parse(t.timeIso) : 0);
        if (ts >= start && ts < end) { stx += toStx(t.amountMicro); count++; }
      }
      const hour = new Date(end).getHours().toString().padStart(2, '0');
      buckets.push({ label: `${hour}:00`, stx: Number(stx.toFixed(6)), count });
    }
    return buckets;
  }, [recent]);

  const tipsDaily14 = useMemo(() => {
    const dayMs = 24 * 3600_000;
    const endOfToday = new Date(); endOfToday.setHours(24, 0, 0, 0);
    const endAligned = endOfToday.getTime();
    const buckets: { label: string; stx: number; count: number }[] = [];
    const toStx = (micro: string) => Number(BigInt(micro)) / 1_000_000;
    for (let i = 13; i >= 0; i--) {
      const end = endAligned - i * dayMs;
      const start = end - dayMs;
      let stx = 0, count = 0;
      for (const t of recent) {
        const ts = typeof t.timeMs === 'number' && t.timeMs > 0
          ? t.timeMs
          : (t.timeIso ? Date.parse(t.timeIso) : 0);
        if (ts >= start && ts < end) { stx += toStx(t.amountMicro); count++; }
      }
      const d = new Date(start + 12 * 3600_000);
      const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      buckets.push({ label, stx: Number(stx.toFixed(6)), count });
    }
    return buckets;
  }, [recent]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tip = useCallback(async () => {
    try {
      setLoading(true);
      const micro = parseStxToMicro(amountStx);
      if (micro <= 0n) throw new Error('Enter a positive amount');
      await openContractCall({
        contractAddress,
        contractName,
        functionName: 'tip',
        functionArgs: [uintCV(micro)],
        network,
        postConditionMode: 1,
        onFinish: async () => {
          await refresh();
          setLoading(false);
          toast('Tip sent successfully')
        },
        onCancel: () => {
          setLoading(false);
          toast('Tip canceled')
        },
        walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
      } as any);
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      toast(e?.message || 'Transaction failed')
    }
  }, [amountStx, contractAddress, contractName, refresh]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{
        minHeight: '100vh',
        color: '#e5e7eb',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: 'radial-gradient(1200px 800px at 10% 10%, rgba(57,255,20,0.08), transparent 40%), radial-gradient(1000px 700px at 90% 20%, rgba(0,255,163,0.08), transparent 40%), linear-gradient(160deg, #0f172a, #1e293b)'
      }}>
        {toastMsg && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(15,23,42,0.95)', // neutral dark
            color: '#e5e7eb', // light text
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 1000
          }}>
            {toastMsg}
          </div>
        )}

        {wcModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div className="spotlight-card" style={{ maxWidth: '500px', width: '100%' }}>
              <div className="emoji-badge">🔗</div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 12px' }}>WalletConnect</h3>
              <p className="subtitle">
                This opens WalletConnect for mobile wallet pairing.
                In production, this uses Reown AppKit.
              </p>
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="label">Project ID</div>
                <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{WALLETCONNECT_PROJECT_ID}</code>
              </div>
              <button
                onClick={closeWalletConnectModal}
                className="btn btn-primary btn-glow"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="container">
          <header className="nav">
            <div className="logo">
              <div className="logo-badge">💧</div>
              <div>Tip Jar</div>
            </div>
            <div className="actions">
              {!connected ? (
                <>
                  <button className="btn btn-primary btn-glow" onClick={connect}>
                    Connect Wallet
                  </button>
                  <button className="btn btn-secondary" onClick={openWalletConnectModal}>
                    WalletConnect
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary" onClick={refresh}>
                  Refresh
                </button>
              )}
            </div>
          </header>

          <section className="hero">
            <div className="aurora aurora-1"></div>
            <div className="aurora aurora-2"></div>
            <div className="aurora aurora-3"></div>

            <div className="hero-card">
              <div className="kicker">On-chain gratitude</div>
              <h1 className="title">
                Send a tip on <span className="gradient-text">Stacks mainnet</span>
              </h1>
              <p className="subtitle">
                Support the creator by sending STX. Tips go directly to the contract creator address.
                Connect a Stacks wallet via WalletConnect and send any amount ≥ 0.1 STX.
              </p>

              <div className="grid">
                <div className="card">
                  <h3>Contract</h3>
                  <div className="label">Identifier</div>
                  <div style={{ wordBreak: 'break-all', fontSize: '13px', marginTop: '8px' }}>
                    <code>{CONTRACT_ID}</code>
                  </div>
                </div>
                <div className="card">
                  <h3>Total Tips</h3>
                  <div className="label">All-time</div>
                  <div className="value gradient-text">{microToStxDisplay(totalTips)} STX</div>
                </div>
              </div>

              <div className="actions" style={{ marginTop: '16px' }}>
                {!connected ? (
                  <>
                    <button className="btn btn-primary btn-glow" onClick={connect}>
                      Connect Wallet
                    </button>
                    <button className="btn btn-secondary" onClick={openWalletConnectModal}>
                      WalletConnect
                    </button>
                  </>
                ) : (
                  <button className="btn btn-secondary" onClick={refresh}>
                    Refresh stats
                  </button>
                )}
              </div>
            </div>

            <div className="hero-card spotlight-card">
              <div className="emoji-badge">💸</div>
              <h3 style={{ marginTop: 0 }}>Send a tip</h3>
              <div className="label">Amount (STX)</div>
              <input
                className="input"
                type="number"
                min="0.1"
                step="0.1"
                value={amountStx}
                onChange={(e) => setAmountStx(e.target.value)}
                style={{ marginTop: '8px' }}
              />
              <div className="actions" style={{ marginTop: '12px' }}>
                <button
                  className="btn btn-primary btn-glow"
                  onClick={tip}
                  disabled={loading || !connected}
                  style={{
                    opacity: (loading || !connected) ? 0.5 : 1,
                    cursor: (loading || !connected) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Sending…' : 'Tip now'}
                </button>
                {!connected && (
                  <>
                    <button className="btn btn-secondary" onClick={connect}>
                      Connect
                    </button>
                    <button className="btn btn-secondary" onClick={openWalletConnectModal}>
                      WC
                    </button>
                  </>
                )}
              </div>
              <p className="subtitle" style={{ marginTop: '12px', marginBottom: 0 }}>
                Minimum tip is 0.1 STX. You will confirm the transaction in your wallet.
              </p>
            </div>
          </section>

          <section style={{ marginTop: '24px' }}>
            <div className="card">
              <h3>Recent tips</h3>
              {recent.length === 0 && <div className="subtitle">No tips yet.</div>}
              {recent.length > 0 && (
                <ul className="tips-list">
                  {recent.map((r, idx) => (
                    <li key={r.txid || r.index || idx} className="tip-item">
                      <div className="tip-avatar" title={r.tipper}>
                        {r.tipper.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="tip-info">
                        <div className="tip-row">
                          <span className="tip-addr">
                            <code title={r.tipper}>{shortAddr(r.tipper)}</code>
                          </span>
                          <span className="tip-amount">{microToStxDisplay(r.amountMicro)} STX</span>
                        </div>
                        <div className="tip-meta">
                          {typeof r.timeMs === 'number' && r.timeMs > 0 ? (
                            <span>{new Date(r.timeMs).toLocaleString()}</span>
                          ) : r.timeIso && (
                            <span>{new Date(r.timeIso).toLocaleString()}</span>
                          )}
                          {r.txid && (
                            <a
                              className="tip-link"
                              href={`https://explorer.hiro.so/txid/${r.txid}?chain=mainnet`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              view
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section style={{ marginTop: '24px' }}>
            <div className="card">
              <h3>Tip activity (last 24h)</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={tipsHourly24} margin={{ left: 4, right: 16, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorStx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39FF14" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#00FFA3" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={{ background: 'rgba(20,24,40,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }} />
                    <Legend />
                    <Area type="monotone" dataKey="stx" name="STX" stroke="#39FF14" fillOpacity={1} fill="url(#colorStx)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section style={{ marginTop: '16px' }}>
            <div className="card">
              <h3>Daily tips (last 14d)</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={tipsDaily14} margin={{ left: 4, right: 16, top: 10, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} width={60} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 11 }} width={40} />
                    <Tooltip contentStyle={{ background: 'rgba(20,24,40,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="stx" name="STX" fill="#00FFA3" />
                    <Bar yAxisId="right" dataKey="count" name="# tips" fill="#39FF14" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <footer className="footer">Built with Stacks • WalletConnect enabled</footer>
        </div>

        <style>{`
          @keyframes bodyBgShift {
            0% { background-position: 10% 10%, 90% 20%, 0% 0%; }
            50% { background-position: 12% 12%, 88% 22%, 0% 0%; }
            100% { background-position: 10% 10%, 90% 20%, 0% 0%; }
          }
          @keyframes floatA {
            0%,100% { transform: translateY(-10px); }
            50% { transform: translateY(10px); }
          }
          @keyframes floatB {
            0%,100% { transform: translateX(10px); }
            50% { transform: translateX(-10px); }
          }
          @keyframes floatC {
            0%,100% { transform: translate(5px,-5px); }
            50% { transform: translate(-5px,5px); }
          }
          @keyframes heroDrift {
            0% { transform: translate3d(0,0,0) rotate(0deg) scale(1); }
            50% { transform: translate3d(2%,-1%,0) rotate(5deg) scale(1.02); }
            100% { transform: translate3d(0,0,0) rotate(0deg) scale(1); }
          }

          * { box-sizing: border-box; }
          .container { max-width: 1000px; margin: 0 auto; padding: 32px 20px 80px; }
          
          .logo { display: flex; align-items: center; gap: 12px; font-weight: 800; letter-spacing: 0.2px; }
          .logo-badge {
            width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px;
            background: linear-gradient(145deg, rgba(57,255,20,0.25), rgba(0,255,163,0.25));
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.3);
          }

          .nav { display: flex; align-items: center; justify-content: space-between; }
          .actions { display: flex; gap: 12px; flex-wrap: wrap; }
          
          .hero {
            margin-top: 48px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px;
            position: relative; overflow: hidden;
          }
          .hero::before {
            content: ''; position: absolute; inset: -25% -15% -30% -15%; z-index: 0;
            background: radial-gradient(50% 60% at 20% 30%, rgba(57,255,20,0.18), transparent 70%),
                        radial-gradient(55% 55% at 80% 20%, rgba(0,255,163,0.18), transparent 70%),
                        radial-gradient(60% 60% at 50% 80%, rgba(34,197,94,0.12), transparent 70%);
            filter: blur(60px); animation: heroDrift 28s ease-in-out infinite; pointer-events: none;
          }
          @media (max-width: 900px) {
            .hero { grid-template-columns: 1fr; }
            .grid { grid-template-columns: 1fr !important; }
          }

          .hero-card {
            border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
            backdrop-filter: blur(10px); border-radius: 16px; padding: 28px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.35); position: relative; z-index: 1;
          }

          .aurora {
            position: absolute; inset: -20% -10% auto -10%; filter: blur(40px);
            opacity: 0.6; pointer-events: none;
          }
          .aurora-1 {
            background: radial-gradient(40% 40% at 20% 30%, rgba(57,255,20,0.35), transparent 60%);
            animation: floatA 16s ease-in-out infinite;
          }
          .aurora-2 {
            background: radial-gradient(35% 35% at 80% 20%, rgba(0,255,163,0.35), transparent 60%);
            animation: floatB 18s ease-in-out infinite;
          }
          .aurora-3 {
            background: radial-gradient(45% 45% at 50% 70%, rgba(34,197,94,0.25), transparent 60%);
            animation: floatC 22s ease-in-out infinite;
          }

          .kicker { color: #39FF14; font-weight: 600; letter-spacing: 0.3px; }
          .title { font-size: clamp(28px, 5vw, 44px); font-weight: 800; margin: 10px 0 8px; }
          .subtitle { color: #94a3b8; margin: 0 0 20px; line-height: 1.6; }
          .gradient-text {
            background: linear-gradient(135deg, #39FF14, #00FFA3);
            -webkit-background-clip: text; background-clip: text; color: transparent;
          }

          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .card {
            border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
            backdrop-filter: blur(10px); border-radius: 14px; padding: 20px;
          }
          .card h3 { margin: 0 0 12px; font-size: 16px; font-weight: 700; }
          .label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; }
          .value { font-size: 28px; font-weight: 800; margin-top: 8px; }

          .btn {
            appearance: none; border: 0; cursor: pointer; padding: 12px 16px;
            border-radius: 12px; font-weight: 600;
            transition: transform 0.05s ease, box-shadow 0.2s ease;
          }
          .btn-primary {
            background: linear-gradient(135deg, #39FF14, #00FFA3); color: #0b1020;
            box-shadow: 0 8px 24px rgba(57,255,20,0.25), 0 12px 36px rgba(0,255,163,0.2);
          }
          .btn-primary:hover { transform: translateY(-1px); }
          .btn-secondary {
            background: rgba(255,255,255,0.08); color: #e5e7eb;
            border: 1px solid rgba(255,255,255,0.12);
          }
          .btn-glow {
            box-shadow: 0 0 0 0 rgba(57,255,20,0), 0 12px 36px rgba(0,255,163,0.18);
          }
          .btn-glow:hover {
            box-shadow: 0 0 0 6px rgba(57,255,20,0.10), 0 16px 44px rgba(0,255,163,0.25);
          }

          .input {
            width: 100%; height: 44px; padding: 0 12px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06); color: #e5e7eb;
          }
          .input:focus { outline: 2px solid rgba(57,255,20,0.35); }

          .spotlight-card {
            position: relative;
            border: 1px solid rgba(255,255,255,0.12);
            background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
            border-radius: 16px; padding: 24px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.35);
          }
          .spotlight-card::after {
            content: ''; position: absolute; inset: -1px; border-radius: 16px;
            pointer-events: none;
            background: linear-gradient(135deg, rgba(57,255,20,0.18), rgba(0,255,163,0.18));
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor; mask-composite: exclude;
            padding: 1px; opacity: 0.65;
          }

          .emoji-badge {
            width: 44px; height: 44px; display: grid; place-items: center;
            border-radius: 12px;
            background: linear-gradient(145deg, rgba(57,255,20,0.25), rgba(0,255,163,0.25));
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.3);
            margin-bottom: 10px;
          }

          .tips-list {
            list-style: none; padding: 0; margin: 8px 0 0;
            display: flex; flex-direction: column; gap: 10px;
          }
          .tip-item {
            display: flex; align-items: center; gap: 12px; padding: 10px 12px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.04); border-radius: 12px;
          }
          .tip-avatar {
            flex: 0 0 36px; width: 36px; height: 36px;
            display: grid; place-items: center; border-radius: 10px;
            font-weight: 700; font-size: 12px; color: #0b1020;
            background: linear-gradient(135deg, #39FF14, #00FFA3);
          }
          .tip-info {
            display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;
          }
          .tip-row {
            display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          }
          .tip-addr code { color: #e5e7eb; }
          .tip-amount {
            font-weight: 800; color: #0b1020;
            background: linear-gradient(135deg, #39FF14, #00FFA3);
            padding: 4px 10px; border-radius: 999px; font-size: 14px;
          }
          .tip-meta {
            display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
            color: #94a3b8; font-size: 12px;
          }
          .tip-link {
            color: #e5e7eb; text-decoration: none;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            padding: 2px 8px; border-radius: 8px;
          }
          .tip-link:hover { border-color: rgba(255,255,255,0.25); }

          .footer {
            margin-top: 48px; color: #94a3b8; font-size: 12px; text-align: center;
          }
        `}</style>
      </div>
    </>
  );
}