import React from 'react';
import { IncidentRow } from '../../types/api';
import { ConfidenceBadge } from './ConfidenceBadge';
import { TransitionActions } from './TransitionActions';
import { StatusTimeline } from './StatusTimeline';
import { STATUS_STYLE } from '../../utils/statusStyles';

interface IncidentDetailProps {
  incident: IncidentRow | null;
  operatorName: string;
  onRefresh: () => void;
  onIncidentUpdated: (updated: IncidentRow) => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  incident,
  operatorName,
  onIncidentUpdated,
}) => {
  if (!incident) {
    return (
      <div
        style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--panel-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--panel-border)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '32px', marginBottom: '8px' }}>👈</span>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Select an Incident</h3>
        <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '300px' }}>
          Click an incident from the list or select a pin on the GIS map to inspect details & perform operator actions.
        </p>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[incident.status] || STATUS_STYLE.detected;

  return (
    <div
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        overflowY: 'auto',
      }}
    >
      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Incident: {incident.id}
            </h2>
            <span
              className="status-pill"
              style={{
                color: statusStyle.fg,
                backgroundColor: statusStyle.bg,
                border: `1px solid ${statusStyle.fg}50`,
              }}
            >
              {statusStyle.label}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            DT Asset ID: <strong style={{ color: 'var(--text-primary)' }}>{incident.dtId}</strong>
          </p>
        </div>

        <ConfidenceBadge confidence={incident.confidence} />
      </div>

      {/* Muted Warning Banner */}
      {incident.suppressedBySchedule && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--status-muted-bg)',
            border: '1px solid var(--status-muted-fg)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--status-muted-fg)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>🔕</span>
          <span>
            <strong>Muted Incident:</strong> This fault overlaps with a scheduled maintenance outage. Muted means &quot;don&apos;t panic&quot; — it is visible for tracking but not an unexpected emergency.
          </span>
        </div>
      )}

      {/* Grid Specs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-3)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--panel-border)',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Affected Poles</span>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {incident.affectedPoleCount}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Coordinates</span>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {incident.lat.toFixed(4)}, {incident.lon.toFixed(4)}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Frontier Pole Range</span>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {incident.frontierParentPoleId || 'N/A'} → {incident.frontierChildPoleId || 'N/A'}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PIN Code</span>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {incident.pincode || 'N/A'}
          </div>
        </div>
      </div>

      {/* Human Readable Reasoning */}
      <div
        style={{
          backgroundColor: 'rgba(12, 27, 48, 0.8)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--status-crew-assigned-fg)',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
          Automated Reasoning & Diagnosis
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {incident.reasoning}
        </div>
      </div>

      {/* Operator Legal Transition Action Buttons */}
      <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)' }}>
        <TransitionActions
          incident={incident}
          operatorName={operatorName}
          onSuccess={onIncidentUpdated}
        />
      </div>

      {/* Status Timeline */}
      <StatusTimeline incident={incident} />
    </div>
  );
};
