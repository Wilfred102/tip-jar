import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StacksMainnet } from '@stacks/network';
import { openContractCall, showConnect, UserSession } from '@stacks/connect';
import { callReadOnlyFunction, ClarityValue, cvToJSON, uintCV } from '@stacks/transactions';

const CONTRACT_ID = 'SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.tip-jar';
const WALLETCONNECT_PROJECT_ID = 'your-project-id';
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
  txid?: string 
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

  const toast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Simulate WalletConnect modal (in real app, this would use Reown AppKit)
  const openWalletConnectModal = useCallback(() => {
    setWcModalOpen(true);
    toast('WalletConnect modal opened (simulated)', 'info');
  }, []);

  const closeWalletConnectModal = useCallback(() => {
    setWcModalOpen(false);
  }, []);

  const connect = useCallback(() => {
    toast('Connecting wallet...', 'info');
    showConnect({
      userSession: new UserSession({ appConfig: undefined as any }),
      appDetails: { name: 'STX Tip Jar', icon: window.location.origin + '/favicon.ico' },
      onFinish: () => {
        setConnected(true);
        toast('Wallet connected', 'success');
      },
      onCancel: () => {
        toast('Connection Canceled', 'info')
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
        const repr: string = arg?.repr || 'u0';
        const amountMicro = repr.startsWith('u') ? repr.slice(1) : repr;
        return {
          tipper: tx.sender_address as string,
          amountMicro,
          timeIso: tx.burn_block_time_iso || tx.receipt_time_iso,
          txid: tx.tx_id,
        } as RecentTip;
      });
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
        postConditionMode: 1,
        onFinish: async () => {
          await refresh();
          setLoading(false);
          toast('Tip sent successfully', 'success')
        },
        onCancel: () => {
          setLoading(false);
          toast('Tip canceled', 'info')
        },
        walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
      } as any);
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      toast(e?.message || 'Transaction failed', 'error')
    }
  }, [amountStx, contractAddress, contractName, refresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {toastMsg && (
        <div className="fixed top-4 right-4 bg-purple-600 px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          {toastMsg}
        </div>
      )}

      {wcModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-500/20">
            <h3 className="text-2xl font-bold mb-4">WalletConnect</h3>
            <p className="text-slate-300 mb-6">
              This would open the WalletConnect modal for pairing with mobile wallets. 
              In a real implementation, this uses Reown AppKit.
            </p>
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="text-sm text-slate-400 mb-2">Project ID</div>
              <div className="font-mono text-xs break-all">{WALLETCONNECT_PROJECT_ID}</div>
            </div>
            <button 
              onClick={closeWalletConnectModal}
              className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl">
              💧
            </div>
            <span className="text-xl font-bold">Tip Jar</span>
          </div>
          <div className="flex gap-2">
            {!connected ? (
              <>
                <button 
                  onClick={connect}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition"
                >
                  Connect Wallet
                </button>
                <button 
                  onClick={openWalletConnectModal}
                  className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg font-medium transition"
                >
                  WalletConnect
                </button>
              </>
            ) : (
              <button 
                onClick={refresh}
                className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg font-medium transition"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="text-purple-400 text-sm font-semibold uppercase tracking-wider mb-3">
            On-chain gratitude
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Send a tip on Stacks mainnet
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Support the creator by sending STX. Tips go directly to the contract creator address.
            Connect a Stacks wallet via WalletConnect and send any amount ≥ 0.1 STX.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Contract</h3>
            <div className="text-sm text-slate-400 mb-2">Identifier</div>
            <div className="bg-black/30 p-3 rounded font-mono text-sm break-all">
              {CONTRACT_ID}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold mb-4">Total Tips</h3>
            <div className="text-sm text-slate-400 mb-2">All-time</div>
            <div className="text-3xl font-bold text-purple-400">
              {microToStxDisplay(totalTips)} STX
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 mb-8">
          <h3 className="text-2xl font-bold mb-6">Send a tip</h3>
          <div className="max-w-md">
            <label className="block text-sm text-slate-400 mb-2">Amount (STX)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={amountStx}
              onChange={(e) => setAmountStx(e.target.value)}
              className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
            />
            <div className="flex gap-3 mt-4">
              <button 
                onClick={tip} 
                disabled={loading || !connected}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition"
              >
                {loading ? 'Sending…' : 'Tip now'}
              </button>
              {!connected && (
                <>
                  <button 
                    onClick={connect}
                    className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg font-medium transition"
                  >
                    Connect
                  </button>
                  <button 
                    onClick={openWalletConnectModal}
                    className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg font-medium transition"
                  >
                    WC
                  </button>
                </>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-3">
              Minimum tip is 0.1 STX. You will confirm the transaction in your wallet.
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <h3 className="text-2xl font-bold mb-6">Recent tips</h3>
          {recent.length === 0 && (
            <div className="text-slate-400 text-center py-8">No tips yet.</div>
          )}
          {recent.length > 0 && (
            <ul className="space-y-3">
              {recent.map((r, idx) => (
                <li 
                  key={r.txid || r.index || idx}
                  className="flex items-start gap-4 bg-black/20 rounded-lg p-4 border border-white/5"
                >
                  <div 
                    className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                    title={r.tipper}
                  >
                    {r.tipper.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <code className="text-sm text-slate-300 truncate" title={r.tipper}>
                        {shortAddr(r.tipper)}
                      </code>
                      <span className="font-bold text-purple-400 whitespace-nowrap">
                        {microToStxDisplay(r.amountMicro)} STX
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {r.timeIso && (
                        <span>{new Date(r.timeIso).toLocaleString()}</span>
                      )}
                      {r.txid && (
                        <a
                          href={`https://explorer.hiro.so/txid/${r.txid}?chain=mainnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 transition"
                        >
                          View on explorer →
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <footer className="text-center py-8 text-slate-400 text-sm">
        Built with Stacks • WalletConnect enabled
      </footer>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}