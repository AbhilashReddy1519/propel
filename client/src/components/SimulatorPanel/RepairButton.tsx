import React, { useState } from 'react';
import { IncidentRow, RepairResponse } from '../../types/api';
import { repairIncident } from '../../api/simulator';
import { ApiError } from '../../api/client';

interface RepairButtonProps {
  selectedIncident: IncidentRow | null;
  operatorName: string;
  onSuccess: (res: RepairResponse) => void;
}

export const RepairButton: React.FC<RepairButtonProps> = ({
  selectedIncident,
  operatorName,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error state when selected incident changes
  React.useEffect(() => {
    setError(null);
    setSubmitting(false);
  }, [selectedIncident?.id]);

  const handleRepair = async () => {
    if (!selectedIncident) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await repairIncident(selectedIncident.id, {
        actor: operatorName,
        note: 'Simulated telemetry hardware repair',
      });
      onSuccess(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Repair call failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px border-dashed #6b4a1a' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#7CFFB2', marginBottom: '6px' }}>
        🛠️ Hardware Telemetry Repair (Sim)
      </div>

      {error && (
        <div style={{ padding: '6px 10px', backgroundColor: 'rgba(255,77,94,0.2)', border: '1px solid #ff4d5e', borderRadius: '4px', color: '#ff4d5e', fontSize: '12px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      {!selectedIncident ? (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Select an incident to trigger simulated physical repair / telemetry restoration.
        </p>
      ) : (
        <button
          onClick={handleRepair}
          disabled={submitting}
          style={{
            width: '100%',
            backgroundColor: '#174733',
            color: '#b3f4d2',
            border: '1px solid #7CFFB2',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          {submitting ? 'Simulating Repair...' : `🛠️ Restore Physical Telemetry for ${selectedIncident.id}`}
        </button>
      )}
    </div>
  );
};
