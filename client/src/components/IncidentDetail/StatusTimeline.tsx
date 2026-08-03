import React from 'react';
import { IncidentRow } from '../../types/api';

interface StatusTimelineProps {
  incident: IncidentRow;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ incident }) => {
  const events = [
    { label: 'Detected', time: incident.createdAt, active: true },
    { label: 'Resolved (Pending Telemetry)', time: incident.resolvedAt, active: !!incident.resolvedAt },
    { label: 'Verified', time: incident.verifiedAt, active: !!incident.verifiedAt },
    { label: 'Closed', time: incident.closedAt, active: !!incident.closedAt },
  ];

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'Pending...';
    const d = new Date(isoStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Incident Event Timeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {events.map((ev, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: ev.active ? 'var(--status-crew-assigned-fg)' : 'var(--panel-border)',
                boxShadow: ev.active ? '0 0 6px var(--status-crew-assigned-fg)' : 'none',
              }}
            />
            <span style={{ width: '180px', color: ev.active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: ev.active ? 600 : 400 }}>
              {ev.label}
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {formatDate(ev.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
