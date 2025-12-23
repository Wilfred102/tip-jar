import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_ID, WALLETCONNECT_PROJECT_ID } from './config';
import { StacksMainnet } from '@stacks/network';
import {
  openContractCall,
  showConnect,
  UserSession,
} from '@stacks/connect';
import {
  callReadOnlyFunction,
  ClarityValue,
  contractPrincipalCV,
  cvToJSON,
  principalCV,
  uintCV,
} from '@stacks/transactions';

const network = new StacksMainnet();

function splitContractId(id: string) {
  const [contractAddress, contractName] = id.split('.');
  return { contractAddress, contractName };
}

function microFromStx(input: string): bigint {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1_000_00)) * 10n; // 1e6 avoiding FP overflow
}

type RecentTip = { index: number; tipper: string; amount: string };

export default function App() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [amountStx, setAmountStx] = useState('0.1');
  const [totalTips, setTotalTips] = useState<string>('u0');
  const [recent, setRecent] = useState<RecentTip[]>([]);
  const [loading, setLoading] = useState(false);
  const { contractAddress, contractName } = useMemo(() => splitContractId(CONTRACT_ID), []);

  const connect = useCallback(() => {
    showConnect({
      userSession: new UserSession({ appConfig: undefined as any }),
      appDetails: { name: 'STX Tip Jar', icon: window.location.origin + '/favicon.ico' },
      onFinish: () => {
        setConnected(true);
      },
      onCancel: () => {},
      walletConnectOptions: {
        projectId: WALLETCONNECT_PROJECT_ID,
      },
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

  const fetchRecent = useCallback(async () => {
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
        out.push({ index: i, tipper: v.tipper.value, amount: v.amount.value });
      }
    }
    setRecent(out);
  }, [contractAddress, contractName]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchTotal(), fetchRecent()]);
  }, [fetchTotal, fetchRecent]);

  useEffect(() => {
    refresh();
  }, []);

  const tip = useCallback(async () => {
    try {
      setLoading(true);
      const micro = microFromStx(amountStx);
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
        walletConnectOptions: { projectId: WALLETCONNECT_PROJECT_ID },
      } as any);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [amountStx, contractAddress, contractName, refresh]);

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>STX Tip Jar</h1>
      <p>Contract: <code>{CONTRACT_ID}</code></p>

      <div style={{ margin: '16px 0' }}>
        {!connected ? (
          <button onClick={connect}>Connect Wallet (WalletConnect)</button>
        ) : (
          <span>Wallet connected</span>
        )}
      </div>

      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, marginTop: 16 }}>
        <h3>Send a tip</h3>
        <label>
          Amount (STX):
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={amountStx}
            onChange={(e) => setAmountStx(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </label>
        <button onClick={tip} disabled={loading} style={{ marginLeft: 12 }}>
          {loading ? 'Sending…' : 'Tip'}
        </button>
      </div>

      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, marginTop: 16 }}>
        <h3>Stats</h3>
        <div><strong>Total tipped (µSTX):</strong> {totalTips}</div>
        <button onClick={refresh} style={{ marginTop: 8 }}>Refresh</button>
        <h4 style={{ marginTop: 16 }}>Recent (last 5)</h4>
        {recent.length === 0 && <div>No tips yet.</div>}
        <ul>
          {recent.map((r) => (
            <li key={r.index}>
              <code>{r.tipper}</code> — {r.amount} µSTX
            </li>
          ))}
        </ul>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
        Minimum tip enforced on-chain is 0.1 STX (u100000 µSTX).
      </p>
    </div>
  );
}
