import { useState, useEffect, useCallback } from 'react';
import { DtSummary } from '../types/api';
import { listDts } from '../api/network';

interface UseDtsResult {
  dts: DtSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDts(): UseDtsResult {
  const [dts, setDts] = useState<DtSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listDts();
      const sortedData = [...data].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
      );
      setDts(sortedData);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load DT network context';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer calling fetchDts to avoid synchronous setState inside effect
    // which can cause cascading renders. Schedule on microtask queue.
    void Promise.resolve().then(() => fetchDts());
  }, [fetchDts]);

  return { dts, loading, error, refetch: fetchDts };
}
