import React from 'react';
import { useK8sApi } from '../hooks/useK8sApi';

interface HealthData { status: string; version: string; environment: string; }

const HealthCheck: React.FC = () => {
  const { data, error, loading, lastUpdated } = useK8sApi<HealthData>('/health', 10000);

  return (
    <div className="rounded-xl border border-armor-700 bg-armor-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold tracking-tight">🛡️ K3s Cluster Health</h2>
        {lastUpdated && (
          <span className="text-xs text-armor-200/60">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {loading && <p className="text-armor-200/50 animate-pulse">Connecting to cluster…</p>}

      {error && (
        <div className="rounded-lg bg-threat-900/40 border border-threat-700 p-4">
          <p className="text-threat-500 font-medium">⚠️ K3s Server Down</p>
          <p className="text-threat-100/70 text-sm mt-1">{error}</p>
          <p className="text-threat-100/50 text-xs mt-2">Auto-retrying with exponential backoff…</p>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-shield-500 animate-pulse" />
            <span className="font-medium text-shield-500">Healthy</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-armor-800 p-3">
              <p className="text-armor-200/60 text-xs">Version</p>
              <p className="font-mono font-semibold">{data.version}</p>
            </div>
            <div className="rounded-lg bg-armor-800 p-3">
              <p className="text-armor-200/60 text-xs">Environment</p>
              <p className="font-mono font-semibold">{data.environment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthCheck;
