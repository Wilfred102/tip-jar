import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_ID, WALLETCONNECT_PROJECT_ID } from './config';
import { StacksMainnet } from '@stacks/network';
import { openContractCall, showConnect, UserSession } from '@stacks/connect';
import { callReadOnlyFunction, ClarityValue, cvToJSON, uintCV } from '@stacks/transactions';
import { toast } from 'sonner';

const network = new StacksMainnet();

function splitContractId(id: string) {
  const [contractAddress, contractName] = id.split('.');
  return { contractAddress, contractName };
}

function parseStxToMicro(input: string): bigint {
  // Safe decimal -> microSTX conversion supporting up to 6 decimals
  const trimmed = input.trim();
  if (!/^\d*(?:\.|\,)??\d*$/.test(trimmed)) return 0n;
  const [whole, fracRaw = ''] = trimmed.replace(',', '.').split('.');
  const frac = (fracRaw + '000000').slice(0, 6); // pad to 6
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
  txid?: string 
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [amountStx, setAmountStx] = useState('0.1');
  const [totalTips, setTotalTips] = useState<string>('u0');
  const [recent, setRecent] = useState<RecentTip[]>([]);
  const [loading, setLoading] = useState(false);
  const { contractAddress, contractName } = useMemo(() => splitContractId(CONTRACT_ID), []);

  const connect = useCallback(() => {
    showConnect({
      userSession: new UserSession({ appConfig: undefined as any }),
      appDetails: { name: 'STX Tip Jar', icon: window.location.origin + '/favicon.ico' },
      onFinish: () => setConnected(true),
      onCancel: () => {},
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
    // Hiro mainnet API - recent contract-call txs for this contract
    const base = 'https://api.hiro.so';
    const url = `${base}/extended/v1/address/${contractAddress}.${contractName}/transactions?limit=25`;
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
        // arg.repr like 'u100000' or fallback to hex parse omitted here
        const repr: string = arg?.repr || 'u0';
        const amountMicro = repr.startsWith('u') ? repr.slice(1) : repr;
        return {
          tipper: tx.sender_address as string,
          amountMicro,
          timeIso: tx.burn_block_time_iso || tx.receipt_time_iso,
          txid: tx.tx_id,
        } as RecentTip;
      });
    // Sort by time desc
    items.sort((a: any, b: any) => 
      new Date(b.timeIso || 0).getTime() - new Date(a.timeIso || 0).getTime()
    );
    setRecent(items.slice(0, 10));
  }, [contractAddress, contractName]);

  const fetchRecent = useCallback(async () => {
    try {
      await fetchRecentViaApi();
      return;
    } catch (e) {
      console.warn('API fetch failed, using fallback:', e);
      // Fallback to on-chain ring buffer (order unknown, best-effort)
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

  useEffect(() => {
    refresh();
  }, []);

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
        postConditionMode: 1, // allow
        onFinish: async () => {
          await refresh();
          setLoading(false);
        },
        onCancel: () => setLoading(false),
        walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
      } as any);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [amountStx, contractAddress, contractName, refresh]);

  return (
    <div className="container">
      <header className="nav">
        <div className="logo">
          <div className="logo-badge">💧</div>
          <div>STX Tip Jar</div>
        </div>
        <div className="actions">
          {!connected ? (
            <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
          ) : (
            <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-card">
          <div className="kicker">On-chain gratitude</div>
          <h1 className="title">Send a tip on Stacks mainnet</h1>
          <p className="subtitle">
            Support the creator by sending STX. Tips go directly to the contract creator address.
            Connect a Stacks wallet via WalletConnect and send any amount ≥ 0.1 STX.
          </p>
          <div className="grid">
            <div className="card">
              <h3>Contract</h3>
              <div className="label">Identifier</div>
              <div style={{wordBreak: 'break-all'}}><code>{CONTRACT_ID}</code></div>
            </div>
            <div className="card">
              <h3>Total Tips</h3>
              <div className="label">All-time</div>
              <div className="value">{microToStxDisplay(totalTips)} STX</div>
            </div>
          </div>
          <div className="actions" style={{ marginTop: 16 }}>
            {!connected ? (
              <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
            ) : (
              <button className="btn btn-secondary" onClick={refresh}>Refresh stats</button>
            )}
          </div>
        </div>

        <div className="hero-card">
          <h3 style={{ marginTop: 0 }}>Send a tip</h3>
          <div className="label">Amount (STX)</div>
          <input
            className="input"
            type="number"
            min="0.1"
            step="0.1"
            value={amountStx}
            onChange={(e) => setAmountStx(e.target.value)}
          />
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={tip} disabled={loading || !connected}>
              {loading ? 'Sending…' : 'Tip now'}
            </button>
            {!connected && <button className="btn btn-secondary" onClick={connect}>Connect first</button>}
          </div>
          <p className="subtitle" style={{ marginTop: 12 }}>
            Minimum tip is 0.1 STX. You will confirm the transaction in your wallet.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Recent tips</h3>
          {recent.length === 0 && <div className="subtitle">No tips yet.</div>}
          {recent.length > 0 && (
            <ul className="list">
              {recent.map((r, idx) => (
                <li key={r.txid || r.index || idx}>
                  <code title={r.tipper}>{shortAddr(r.tipper)}</code>
                  {' '}— {microToStxDisplay(r.amountMicro)} STX
                  {r.timeIso && (
                    <span style={{ color: '#94a3b8' }}>
                      {' '}• {new Date(r.timeIso).toLocaleString()}
                    </span>
                  )}
                  {r.txid && (
                    <a
                      href={`https://explorer.hiro.so/txid/${r.txid}?chain=mainnet`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 8 }}
                    >
                      view
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">Built with Stacks • WalletConnect enabled</footer>
    </div>
  );
}