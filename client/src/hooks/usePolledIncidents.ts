import { useState, useEffect, useCallback } from 'react';
import { IncidentRow } from '../types/api';
import { listIncidents } from '../api/incidents';

interface UsePolledIncidentsResult {
  incidents: IncidentRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePolledIncidents(intervalMs: number = 4500): UsePolledIncidentsResult {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await listIncidents(true);
      setIncidents(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch incidents';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, intervalMs);
    return () => clearInterval(interval);
  }, [fetchIncidents, intervalMs]);

  return {
    incidents,
    loading,
    error,
    refetch: fetchIncidents,
  };
}
