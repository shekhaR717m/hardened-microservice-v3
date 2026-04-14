import React from 'react';

const layers = [
  { id: 'L1', name: 'Build', desc: 'Multi-stage Docker (<50 MB)', status: true, icon: '🏗️' },
  { id: 'L2', name: 'Container', desc: 'Non-root UID 1000', status: true, icon: '📦' },
  { id: 'L3', name: 'Filesystem', desc: 'readOnlyRootFilesystem', status: true, icon: '🔒' },
  { id: 'L4', name: 'Network', desc: 'NetworkPolicy isolation', status: true, icon: '🌐' },
  { id: 'L5', name: 'Runtime', desc: 'Triple-1000 SecurityContext', status: true, icon: '⚙️' },
  { id: 'L6', name: 'CI/CD', desc: 'Trivy CVE gate', status: true, icon: '🔍' },
  { id: 'L7', name: 'Observability', desc: 'Prometheus alerting', status: true, icon: '📡' },
];

const ClusterStatus: React.FC = () => (
  <div className="rounded-xl border border-armor-700 bg-armor-900 p-6">
    <h2 className="text-lg font-semibold tracking-tight mb-4">🏰 Defense in Depth — Layer Status</h2>
    <div className="space-y-2">
      {layers.map((layer) => (
        <div key={layer.id} className="flex items-center gap-3 rounded-lg bg-armor-800/50 p-3">
          <span className="text-xl">{layer.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-armor-200/50">{layer.id}</span>
              <span className="font-semibold text-sm">{layer.name}</span>
            </div>
            <p className="text-xs text-armor-200/60">{layer.desc}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            layer.status ? 'bg-shield-900/40 text-shield-500' : 'bg-threat-900/40 text-threat-500'
          }`}>
            {layer.status ? '● Active' : '○ Inactive'}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default ClusterStatus;
