import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

interface MetricPoint {
  time: string;
  p95Latency: number;
  errorRate: number;
}

function generateMockData(): MetricPoint[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    time: new Date(now - (29 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    p95Latency: 100 + Math.random() * 350 + (i > 20 ? Math.random() * 200 : 0),
    errorRate: 0.5 + Math.random() * 3 + (i > 25 ? Math.random() * 4 : 0),
  }));
}

const PrometheusGraph: React.FC = () => {
  const [data, setData] = useState<MetricPoint[]>(generateMockData);

  useEffect(() => {
    // In production, query Prometheus:
    // histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
    // rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
    const id = setInterval(() => {
      setData(prev => {
        const newPoint: MetricPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          p95Latency: 100 + Math.random() * 400,
          errorRate: 0.5 + Math.random() * 5,
        };
        return [...prev.slice(1), newPoint];
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-armor-700 bg-armor-900 p-6">
      <h2 className="text-lg font-semibold tracking-tight mb-4">📊 Prometheus — Latency & Error Rate</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="#22c55e" label={{ value: 'p95 (ms)', angle: -90, position: 'insideLeft', style: { fill: '#22c55e', fontSize: 12 } }} />
          <YAxis yAxisId="right" orientation="right" stroke="#ef4444" label={{ value: 'Error %', angle: 90, position: 'insideRight', style: { fill: '#ef4444', fontSize: 12 } }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend />
          <ReferenceLine yAxisId="left" y={500} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '500ms SLO', fill: '#ef4444', fontSize: 11 }} />
          <ReferenceLine yAxisId="right" y={5} stroke="#f97316" strokeDasharray="6 3" label={{ value: '5% Error SLO', fill: '#f97316', fontSize: 11 }} />
          <Line yAxisId="left" type="monotone" dataKey="p95Latency" stroke="#22c55e" strokeWidth={2} dot={false} name="p95 Latency (ms)" />
          <Area yAxisId="right" type="monotone" dataKey="errorRate" fill="#ef444433" stroke="#ef4444" strokeWidth={1.5} name="Error Rate (%)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PrometheusGraph;
