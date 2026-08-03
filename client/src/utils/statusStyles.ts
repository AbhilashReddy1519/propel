import { IncidentStatus, IncidentConfidence } from '../types/api';

export const STATUS_STYLE: Record<IncidentStatus, { fg: string; bg: string; label: string }> = {
  detected: {
    fg: 'var(--status-detected-fg)',
    bg: 'var(--status-detected-bg)',
    label: 'Detected',
  },
  acknowledged: {
    fg: 'var(--status-acknowledged-fg)',
    bg: 'var(--status-acknowledged-bg)',
    label: 'Acknowledged',
  },
  crew_assigned: {
    fg: 'var(--status-crew-assigned-fg)',
    bg: 'var(--status-crew-assigned-bg)',
    label: 'Crew Assigned',
  },
  resolved: {
    fg: 'var(--status-resolved-fg)',
    bg: 'var(--status-resolved-bg)',
    label: 'Resolved (pending)',
  },
  verified: {
    fg: 'var(--status-verified-fg)',
    bg: 'var(--status-verified-bg)',
    label: 'Verified',
  },
  closed: {
    fg: 'var(--status-closed-fg)',
    bg: 'var(--status-closed-bg)',
    label: 'Closed',
  },
};

export const CONFIDENCE_STYLE: Record<IncidentConfidence, { fg: string; label: string; icon: string }> = {
  high: {
    fg: 'var(--confidence-known-fg)',
    label: 'Known topology',
    icon: '●',
  },
  inferred: {
    fg: 'var(--confidence-inferred-fg)',
    label: 'Inferred (estimate)',
    icon: '▲',
  },
  range: {
    fg: 'var(--confidence-range-fg)',
    label: 'Range estimate',
    icon: '◇',
  },
};
