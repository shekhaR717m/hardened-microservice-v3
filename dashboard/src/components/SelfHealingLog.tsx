import React, { useState, useEffect } from 'react';

interface RestartEvent {
  id: string;
  timestamp: string;
  podName: string;
  reason: string;
  attempt: number;
  maxAttempts: number;
}

const MOCK_EVENTS: RestartEvent[] = [
  { id: '1', timestamp: new Date(Date.now() - 120000).toISOString(), podName: 'my-app-7d8f9b4c6-xk2p1', reason: 'OOMKilled', attempt: 3, maxAttempts: 5 },
  { id: '2', timestamp: new Date(Date.now() - 300000).toISOString(), podName: 'my-app-7d8f9b4c6-xk2p1', reason: 'CrashLoopBackOff', attempt: 2, maxAttempts: 5 },
  { id: '3', timestamp: new Date(Date.now() - 600000).toISOString(), podName: 'my-app-a3b2c1d0e-mn4q8', reason: 'Liveness probe failed', attempt: 1, maxAttempts: 5 },
];

const SelfHealingLog: React.FC = () => {
  const [events, setEvents] = useState<RestartEvent[]>(MOCK_EVENTS);

  useEffect(() => {
    // In production, poll K8s Events API: /api/v1/events?fieldSelector=reason=Killing
    const id = setInterval(() => {
      // Simulate potential new event
      if (Math.random() < 0.1) {
        const newEvent: RestartEvent = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          podName: `my-app-${Math.random().toString(36).slice(2, 8)}`,
          reason: ['OOMKilled', 'Liveness probe failed', 'CrashLoopBackOff'][Math.floor(Math.random() * 3)],
          attempt: Math.ceil(Math.random() * 5),
          maxAttempts: 5,
        };
        setEvents(prev => [newEvent, ...prev].slice(0, 50));
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString();

  return (
    <div className="rounded-xl border border-armor-700 bg-armor-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold tracking-tight">🔄 Self-Healing Log</h2>
        <span className="text-xs bg-armor-800 text-armor-200/70 px-2 py-1 rounded-full">
          {events.length} events
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 rounded-lg bg-armor-800/60 p-3 text-sm">
            <span className="text-amber-400 mt-0.5">⟳</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-armor-200/50">[{formatTime(event.timestamp)}]</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  event.reason === 'OOMKilled' ? 'bg-threat-900/50 text-threat-500' :
                  event.reason === 'CrashLoopBackOff' ? 'bg-amber-900/50 text-amber-400' :
                  'bg-blue-900/50 text-blue-400'
                }`}>{event.reason}</span>
              </div>
              <p className="text-armor-200/80 truncate mt-1">
                Pod <span className="font-mono text-xs">{event.podName}</span> restarted
              </p>
              <p className="text-armor-200/40 text-xs">
                Attempt {event.attempt}/{event.maxAttempts}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelfHealingLog;
