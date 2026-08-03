import React from 'react';
import { IncidentRow } from '../../types/api';
import { STATUS_STYLE, CONFIDENCE_STYLE } from '../../utils/statusStyles';

interface IncidentListItemProps {
  incident: IncidentRow;
  isSelected: boolean;
  onSelect: (incident: IncidentRow) => void;
}

export const IncidentListItem: React.FC<IncidentListItemProps> = ({
  incident,
  isSelected,
  onSelect,
}) => {
  const statusStyle = STATUS_STYLE[incident.status] || STATUS_STYLE.detected;
  const confStyle = CONFIDENCE_STYLE[incident.confidence] || CONFIDENCE_STYLE.high;

  const isMuted = incident.suppressedBySchedule;

  return (
    <div
      onClick={() => onSelect(incident)}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: isSelected ? 'rgba(102, 181, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
        border: isSelected ? '1px solid var(--status-crew-assigned-fg)' : '1px solid var(--panel-border)',
        opacity: isMuted ? 0.6 : 1,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: 'var(--space-2)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            DT: {incident.dtId}
          </span>
          <span
            className="status-pill"
            style={{
              color: statusStyle.fg,
              backgroundColor: statusStyle.bg,
              border: `1px solid ${statusStyle.fg}40`,
            }}
          >
            {statusStyle.label}
          </span>

          {isMuted && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--status-muted-fg)',
                backgroundColor: 'var(--status-muted-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(139, 166, 200, 0.3)',
              }}
            >
              Muted — scheduled outage
            </span>
          )}
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Poles: <strong style={{ color: 'var(--text-primary)' }}>{incident.affectedPoleCount}</strong></span>
          {incident.pincode && <span>PIN: <strong style={{ color: 'var(--text-primary)' }}>{incident.pincode}</strong></span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: confStyle.fg }}>
          <span>{confStyle.icon}</span>
          <span style={{ fontSize: '11px' }}>{confStyle.label}</span>
        </div>
      </div>
    </div>
  );
};
