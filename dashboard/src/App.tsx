import React from 'react';
import HealthCheck from './components/HealthCheck';
import IdentityMonitor from './components/IdentityMonitor';
import FilesystemLockStatus from './components/FilesystemLockStatus';
import SelfHealingLog from './components/SelfHealingLog';
import PrometheusGraph from './components/PrometheusGraph';
import ClusterStatus from './components/ClusterStatus';

const App: React.FC = () => (
  <div className="min-h-screen bg-armor-950 text-gray-100">
    {/* Header */}
    <header className="border-b border-armor-700 bg-armor-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏰</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">DevSecOps Dashboard</h1>
            <p className="text-xs text-armor-200/60">Hardened Microservice Ecosystem v3 — Defense in Depth</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-shield-500 animate-pulse" />
          <span className="text-sm text-armor-200/70">Live Monitoring</span>
        </div>
      </div>
    </header>

    {/* Dashboard Grid */}
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Row 1: Health + Identity + Filesystem */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <HealthCheck />
        <IdentityMonitor />
        <FilesystemLockStatus />
      </div>

      {/* Row 2: Prometheus Graph (full width) */}
      <div className="mb-6">
        <PrometheusGraph />
      </div>

      {/* Row 3: Self-Healing + Defense Layers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelfHealingLog />
        <ClusterStatus />
      </div>
    </main>

    {/* Footer */}
    <footer className="border-t border-armor-700 bg-armor-900/50 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-armor-200/40">
        Triple-1000 Security Context (UID:GID:FSGroup = 1000:1000:1000) · Read-Only Filesystem · NetworkPolicy Isolation
      </div>
    </footer>
  </div>
);

export default App;
