import React from 'react';
import { IncidentRow } from '../../types/api';
import { IncidentListItem } from './IncidentListItem';

interface IncidentListProps {
  incidents: IncidentRow[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: IncidentRow) => void;
  loading: boolean;
  error: string | null;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  loading,
  error,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--panel-bg)',
        borderRight: '1px solid var(--panel-border)',
        padding: 'var(--space-4)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Incidents ({incidents.length})
        </h2>
        {loading && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Polling...</span>}
      </div>

      {error && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(255, 77, 94, 0.15)',
            border: '1px solid var(--status-detected-fg)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--status-detected-fg)',
            fontSize: '12px',
            marginBottom: 'var(--space-3)',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {incidents.length === 0 && !loading ? (
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px border-dashed var(--panel-border)',
            margin: 'auto 0',
          }}
        >
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>🟢</p>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-verified-fg)' }}>All Clear</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>No active network faults detected.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {incidents.map((incident) => (
            <IncidentListItem
              key={incident.id}
              incident={incident}
              isSelected={incident.id === selectedIncidentId}
              onSelect={onSelectIncident}
            />
          ))}
        </div>
      )}
    </div>
  );
};
