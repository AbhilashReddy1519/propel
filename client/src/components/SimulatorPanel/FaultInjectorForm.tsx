import React, { useState, useEffect } from 'react';
import { DtSummary, PoleSummary, InjectFaultResponse } from '../../types/api';
import { listPolesForDt } from '../../api/network';
import { injectFault } from '../../api/simulator';
import { ApiError } from '../../api/client';

interface FaultInjectorFormProps {
  dts: DtSummary[];
  selectedDtId: string;
  onSelectDt: (dtId: string) => void;
  selectedPoleId: string;
  onSelectPole: (poleId: string) => void;
  onPolesLoaded: (poles: PoleSummary[]) => void;
  onSuccess: (res: InjectFaultResponse) => void;
}

export const FaultInjectorForm: React.FC<FaultInjectorFormProps> = ({
  dts,
  selectedDtId,
  onSelectDt,
  selectedPoleId,
  onSelectPole,
  onPolesLoaded,
  onSuccess,
}) => {
  const [faultType, setFaultType] = useState<'span' | 'dt' | 'feeder'>('span');
  const [poles, setPoles] = useState<PoleSummary[]>([]);
  const [loadingPoles, setLoadingPoles] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch poles dynamically when selectedDtId changes
  useEffect(() => {
    if (!selectedDtId) return;

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPoles(true);
    setError(null);

    listPolesForDt(selectedDtId)
      .then((data) => {
        if (isMounted) {
          const sortedPoles = [...data].sort((a, b) =>
            a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
          );
          setPoles(sortedPoles);
          onPolesLoaded(sortedPoles);
          if (sortedPoles.length > 0 && !selectedPoleId) {
            onSelectPole(sortedPoles[0].id);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch poles');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingPoles(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDtId, onPolesLoaded, onSelectPole, selectedPoleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDtId) {
      setError('Please select a Distribution Transformer (DT)');
      return;
    }
    if (faultType === 'span' && !selectedPoleId) {
      setError('Target pole is required for Span faults');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await injectFault({
        type: faultType,
        dtId: selectedDtId,
        targetId: faultType === 'span' ? selectedPoleId : undefined,
      });
      onSuccess(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Fault injection failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#ffb84d' }}>
        ⚡ Fault Injector Tool
      </div>

      {error && (
        <div style={{ padding: '6px 10px', backgroundColor: 'rgba(255,77,94,0.2)', border: '1px solid #ff4d5e', borderRadius: '4px', color: '#ff4d5e', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* DT Dropdown */}
      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Select DT:
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
            fontSize: '13px',
          }}
        >
          {dts.map((dt) => (
            <option key={dt.id} value={dt.id}>
              {dt.id} ({dt.feederId} • {dt.householdsServed} hh)
            </option>
          ))}
        </select>
      </div>

      {/* Fault Type Radio / Segmented Control */}
      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Fault Scope:
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['span', 'dt', 'feeder'] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setFaultType(t)}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: faultType === t ? '#6b4a1a' : 'rgba(255,255,255,0.03)',
                color: faultType === t ? '#ffe59a' : 'var(--text-muted)',
                border: `1px solid ${faultType === t ? '#ffb84d' : 'var(--panel-border)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Target Pole Picker (visible when faultType === 'span') */}
      {faultType === 'span' && (
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Target Pole {loadingPoles && '(Loading poles...)'} (Pick from dropdown or click on GIS map):
          </label>
          <select
            value={selectedPoleId}
            onChange={(e) => onSelectPole(e.target.value)}
            disabled={loadingPoles || poles.length === 0}
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
            {poles.map((p) => (
              <option key={p.id} value={p.id}>
                Pole {p.id} {p.hasDevice ? ' (Device attached)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          backgroundColor: '#5a3a1d',
          color: '#ffb84d',
          border: '1px solid #ffb84d',
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: submitting ? 'wait' : 'pointer',
          marginTop: '4px',
        }}
      >
        {submitting ? 'Injecting Fault...' : `🧪 Inject ${faultType.toUpperCase()} Fault`}
      </button>
    </form>
  );
};
