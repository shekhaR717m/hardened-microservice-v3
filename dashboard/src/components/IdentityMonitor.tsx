import React from 'react';
import { useK8sApi } from '../hooks/useK8sApi';

interface IdentityData { uid: number; gid: number; user: string; }

const IdentityMonitor: React.FC = () => {
  const { data, error, loading } = useK8sApi<IdentityData>('/security/identity', 15000);
  const isNonRoot = data ? data.uid === 1000 : false;

  return (
    <div className="rounded-xl border border-armor-700 bg-armor-900 p-6">
      <h2 className="text-lg font-semibold tracking-tight mb-4">🪪 Identity Monitor</h2>

      {loading && <p className="text-armor-200/50 animate-pulse">Checking process identity…</p>}
      {error && <p className="text-threat-500 text-sm">{error}</p>}

      {data && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 rounded-lg p-4 ${
            isNonRoot ? 'bg-shield-900/30 border border-shield-700' : 'bg-threat-900/30 border border-threat-700'
          }`}>
            <span className="text-3xl">{isNonRoot ? '✅' : '🚨'}</span>
            <div>
              <p className={`font-bold ${isNonRoot ? 'text-shield-500' : 'text-threat-500'}`}>
                {isNonRoot ? 'Non-Root — Secure' : 'Running as Root — SECURITY RISK'}
              </p>
              <p className="text-sm text-armor-200/70">
                UID:{data.uid} GID:{data.gid} User:{data.user}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              { label: 'UID', value: data.uid, expected: 1000 },
              { label: 'GID', value: data.gid, expected: 1000 },
              { label: 'FSGroup', value: 1000, expected: 1000 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-armor-800 p-3">
                <p className="text-xs text-armor-200/60">{item.label}</p>
                <p className={`font-mono font-bold text-lg ${
                  item.value === item.expected ? 'text-shield-500' : 'text-threat-500'
                }`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IdentityMonitor;
