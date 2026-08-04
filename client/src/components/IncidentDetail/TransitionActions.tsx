import React, { useState } from 'react';
import { IncidentRow, IncidentStatus } from '../../types/api';
import { ALLOWED_NEXT, TRANSITION_BUTTON_LABELS } from '../../utils/transitions';
import { transitionIncident } from '../../api/incidents';
import { ApiError } from '../../api/client';

interface TransitionActionsProps {
  incident: IncidentRow;
  operatorName: string;
  onSuccess: (updated: IncidentRow) => void;
}

export const TransitionActions: React.FC<TransitionActionsProps> = ({
  incident,
  operatorName,
  onSuccess,
}) => {
  const [submittingStatus, setSubmittingStatus] = useState<IncidentStatus | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Clear error state whenever selected incident changes
  React.useEffect(() => {
    return () => {
      setConflictError(null);
      setSubmittingStatus(null);
    };
  }, [incident.id]);

  const allowedNextStatuses = ALLOWED_NEXT[incident.status] || [];

  const handleTransition = async (targetStatus: IncidentStatus) => {
    // Note: 'verified' is telemetry-only; enforce typescript guard
    if (targetStatus === 'verified') return;

    setSubmittingStatus(targetStatus);
    setConflictError(null);

    try {
      const updated = await transitionIncident(incident.id, {
        status: targetStatus as 'acknowledged' | 'crew_assigned' | 'resolved' | 'closed',
        actor: operatorName,
      });
      onSuccess(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        // Display exact server error text inline
        setConflictError(err.message);
      } else {
        setConflictError(err instanceof Error ? err.message : 'Transition failed');
      }
    } finally {
      setSubmittingStatus(null);
    }
  };

  if (allowedNextStatuses.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Ticket reached final state ({incident.status}). No further actions available.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Operator Action (Ticket Lifecycle)
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {allowedNextStatuses.map((targetStatus) => {
          const isPending = submittingStatus === targetStatus;
          const label = TRANSITION_BUTTON_LABELS[targetStatus] || targetStatus;

          return (
            <button
              key={targetStatus}
              onClick={() => handleTransition(targetStatus)}
              disabled={isPending}
              style={{
                backgroundColor: 'var(--status-crew-assigned-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--status-crew-assigned-fg)',
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: isPending ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              {isPending && <span style={{ fontSize: '12px' }}>⏳</span>}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Prominent Red Inline Banner on 409 Conflict Rejection */}
      {conflictError && (
        <div
          style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(255, 77, 94, 0.18)',
            border: '1px solid var(--status-detected-fg)',
            borderRadius: 'var(--radius-sm)',
            color: '#ff8a95',
            fontSize: '13px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>🚫</span>
          <div>
            <strong>Action Rejected (Server 409 Conflict):</strong>
            <div style={{ marginTop: '2px' }}>{conflictError}</div>
          </div>
        </div>
      )}
    </div>
  );
};
