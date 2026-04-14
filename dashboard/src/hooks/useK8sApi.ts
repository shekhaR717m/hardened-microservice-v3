import { useState, useEffect, useCallback, useRef } from 'react';

interface K8sState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const API_BASE = '/api';

export function useK8sApi<T>(endpoint: string, intervalMs = 10000): K8sState<T> & { refetch: () => void } {
  const [state, setState] = useState<K8sState<T>>({ data: null, loading: true, error: null, lastUpdated: null });
  const backoffRef = useRef(intervalMs);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) {
        if (res.status === 0 || res.status >= 500) {
          throw new Error(`K3s API unreachable (port 6443) — Connection Refused`);
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setState({ data: json as T, loading: false, error: null, lastUpdated: new Date() });
      backoffRef.current = intervalMs; // reset backoff on success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({ ...prev, loading: false, error: message }));
      backoffRef.current = Math.min(backoffRef.current * 2, 60000); // exponential backoff max 60s
    }
  }, [endpoint, intervalMs]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, backoffRef.current);
    return () => clearInterval(id);
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
