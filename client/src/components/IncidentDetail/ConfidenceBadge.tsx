import React from 'react';
import { IncidentConfidence } from '../../types/api';
import { CONFIDENCE_STYLE } from '../../utils/statusStyles';

interface ConfidenceBadgeProps {
  confidence: IncidentConfidence;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  const confInfo = CONFIDENCE_STYLE[confidence] || CONFIDENCE_STYLE.high;

  return (
    <div
      className="confidence-badge"
      style={{
        color: confInfo.fg,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${confInfo.fg}40`,
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
      }}
    >
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{confInfo.icon}</span>
      <span>{confInfo.label}</span>
    </div>
  );
};
