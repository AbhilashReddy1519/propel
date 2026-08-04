import React, { useState } from 'react';
import { DtSummary, PoleSummary, IncidentRow, InjectFaultResponse, InjectNoiseResponse, RepairResponse } from '../../types/api';
import { FaultInjectorForm } from './FaultInjectorForm';
import { NoiseInjectorForm } from './NoiseInjectorForm';
import { RepairButton } from './RepairButton';

interface SimulatorPanelProps {
  dts: DtSummary[];
  selectedIncident: IncidentRow | null;
  operatorName: string;
  selectedPoleId: string;
  onSelectPole: (poleId: string) => void;
  onPolesLoaded: (poles: PoleSummary[]) => void;
  onActionComplete: () => void;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  dts,
  selectedIncident,
  operatorName,
  selectedPoleId,
  onSelectPole,
  onPolesLoaded,
  onActionComplete,
}) => {
  const [selectedDtId, setSelectedDtId] = useState<string>('');
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Set default DT when DT list loads
  React.useEffect(() => {
    if (dts.length > 0 && !selectedDtId) {
      // Defer setting state to avoid synchronous setState inside effect which can
      // cause cascading renders. Using a microtask to schedule the update.
      const t = setTimeout(() => setSelectedDtId(dts[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [dts, selectedDtId]);

  const handleFaultSuccess = (res: InjectFaultResponse) => {
    setBannerMessage({
      text: `Fault Injected successfully! ${res.description || ''} (${res.affectedDeviceCount} devices affected)`,
      type: 'success',
    });
    onActionComplete();
  };

  const handleNoiseSuccess = (res: InjectNoiseResponse) => {
    setBannerMessage({
      text: `Noise Injected! ${res.message}`,
      type: 'info',
    });
    onActionComplete();
  };

  const handleRepairSuccess = (res: RepairResponse) => {
    setBannerMessage({
      text: `Telemetry Repaired! ${res.repairedDeviceCount} devices restored for incident ${res.incidentId}.`,
      type: 'success',
    });
    onActionComplete();
  };

  return (
    <section
      className="simulator-panel-bg"
      style={{
        padding: 'var(--space-4)',
        marginTop: 'var(--space-4)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Visual Safety Warning Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: 'var(--space-3)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid #6b4a1a',
        }}
      >
        <span style={{ fontSize: '20px' }}>🧪</span>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffe59a', letterSpacing: '0.02em' }}>
            🧪 Simulator — test controls, not real operations
          </h3>
          <p style={{ fontSize: '11px', color: '#ffb84d' }}>
            Synthetic telemetry & fault injection tools for system testing and validation.
          </p>
        </div>
      </div>

      {/* Response notification banner */}
      {bannerMessage && (
        <div
          style={{
            marginBottom: 'var(--space-3)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: bannerMessage.type === 'success' ? 'rgba(124, 255, 178, 0.15)' : 'rgba(255, 184, 77, 0.15)',
            border: `1px solid ${bannerMessage.type === 'success' ? '#7CFFB2' : '#ffb84d'}`,
            color: bannerMessage.type === 'success' ? '#7CFFB2' : '#ffe59a',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Forms Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
        <FaultInjectorForm
          dts={dts}
          selectedDtId={selectedDtId}
          onSelectDt={setSelectedDtId}
          selectedPoleId={selectedPoleId}
          onSelectPole={onSelectPole}
          onPolesLoaded={onPolesLoaded}
          onSuccess={handleFaultSuccess}
        />

        <div style={{ borderLeft: '1px solid rgba(107, 74, 26, 0.4)', paddingLeft: 'var(--space-4)' }}>
          <NoiseInjectorForm
            dts={dts}
            selectedDtId={selectedDtId}
            onSelectDt={setSelectedDtId}
            onSuccess={handleNoiseSuccess}
          />

          <RepairButton
            selectedIncident={selectedIncident}
            operatorName={operatorName}
            onSuccess={handleRepairSuccess}
          />
        </div>
      </div>
    </section>
  );
};
