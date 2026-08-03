import React from 'react';
import { IncidentRow, IncidentStatus } from '../../types/api';

interface HeaderProps {
  incidents: IncidentRow[];
  operatorName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  incidents,
  operatorName = 'Operator Alpha',
}) => {
  const activeIncidents = incidents.filter(
    (i) => i.status !== 'verified' && i.status !== 'closed'
  );
  const activeCount = activeIncidents.length;

  // Breakdown by status
  const statusCounts = activeIncidents.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.status] = (acc[inc.status] || 0) + 1;
    return acc;
  }, {});

  const statusOrder: IncidentStatus[] = ['detected', 'acknowledged', 'crew_assigned', 'resolved'];
  const breakdownParts = statusOrder
    .filter((st) => statusCounts[st] > 0)
    .map((st) => {
      const label = st.replace('_', ' ');
      return `${statusCounts[st]} ${label}`;
    });

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-5)',
        backgroundColor: 'var(--panel-bg)',
        borderBottom: '1px solid var(--panel-border)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Operator Console
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Grid Control Room • Automated Fault Detection</p>
          </div>
        </div>

        <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--panel-border)', margin: '0 8px' }} />

        {/* 10-second glanceable status counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-2)',
              backgroundColor: activeCount > 0 ? 'rgba(255, 77, 94, 0.15)' : 'rgba(179, 244, 210, 0.12)',
              border: `1px solid ${activeCount > 0 ? 'var(--status-detected-fg)' : 'var(--status-verified-fg)'}`,
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: activeCount > 0 ? 'var(--status-detected-fg)' : 'var(--status-verified-fg)',
                lineHeight: 1,
              }}
            >
              {activeCount}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeCount === 1 ? 'Active Incident' : 'Active Incidents'}
            </span>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
            {activeCount === 0 ? (
              <span style={{ color: 'var(--status-verified-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px' }}>●</span> All clear
              </span>
            ) : (
              <span>{breakdownParts.join('  •  ')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Operator identity badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--panel-border)',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#7CFFB2',
            boxShadow: '0 0 8px #7CFFB2',
          }}
        />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{operatorName}</span>
      </div>
    </header>
  );
};
