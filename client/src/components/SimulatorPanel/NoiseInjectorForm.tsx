import React, { useState } from 'react';
import { DtSummary, InjectNoiseResponse } from '../../types/api';
import { injectNoise } from '../../api/simulator';
import { ApiError } from '../../api/client';

interface NoiseInjectorFormProps {
  dts: DtSummary[];
  selectedDtId: string;
  onSelectDt: (dtId: string) => void;
  onSuccess: (res: InjectNoiseResponse) => void;
}

export const NoiseInjectorForm: React.FC<NoiseInjectorFormProps> = ({
  dts,
  selectedDtId,
  onSelectDt,
  onSuccess,
}) => {
  const [noiseType, setNoiseType] = useState<'single_sensor_failure' | 'scheduled_outage'>('single_sensor_failure');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDtId) {
      setError('Please select a DT');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await injectNoise({
        dtId: selectedDtId,
        noiseType,
      });
      onSuccess(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Noise injection failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#ffb84d' }}>
        📡 Sensor Noise & Outage Injector
      </div>

      {error && (
        <div style={{ padding: '6px 10px', backgroundColor: 'rgba(255,77,94,0.2)', border: '1px solid #ff4d5e', borderRadius: '4px', color: '#ff4d5e', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Target DT:
        </label>
        <select
          value={selectedDtId}
          onChange={(e) => onSelectDt(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            backgroundColor: 'rgba(7, 17, 31, 0.9)',
            border: '1px solid #6b4a1a',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
          }}
        >
          {dts.map((dt) => (
            <option key={dt.id} value={dt.id}>
              {dt.id} ({dt.feederId})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Noise Mode:
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setNoiseType('single_sensor_failure')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: noiseType === 'single_sensor_failure' ? '#6b4a1a' : 'rgba(255,255,255,0.03)',
              color: noiseType === 'single_sensor_failure' ? '#ffe59a' : 'var(--text-muted)',
              border: `1px solid ${noiseType === 'single_sensor_failure' ? '#ffb84d' : 'var(--panel-border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Single Sensor Failure
          </button>

          <button
            type="button"
            onClick={() => setNoiseType('scheduled_outage')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: noiseType === 'scheduled_outage' ? '#6b4a1a' : 'rgba(255,255,255,0.03)',
              color: noiseType === 'scheduled_outage' ? '#ffe59a' : 'var(--text-muted)',
              border: `1px solid ${noiseType === 'scheduled_outage' ? '#ffb84d' : 'var(--panel-border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Scheduled Outage
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          backgroundColor: 'rgba(107, 74, 26, 0.4)',
          color: '#ffe59a',
          border: '1px solid #6b4a1a',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: submitting ? 'wait' : 'pointer',
        }}
      >
        {submitting ? 'Injecting...' : '📡 Inject Telemetry Noise'}
      </button>
    </form>
  );
};
