'use client';

import React, { useState, useEffect } from 'react';
import { IncidentRow, PoleSummary } from '../src/types/api';
import { usePolledIncidents } from '../src/hooks/usePolledIncidents';
import { useDts } from '../src/hooks/useDts';

import { Header } from '../src/components/Header/Header';
import { IncidentList } from '../src/components/IncidentList/IncidentList';
import { NetworkMap } from '../src/components/NetworkMap/NetworkMap';
import { IncidentDetail } from '../src/components/IncidentDetail/IncidentDetail';
import { SimulatorPanel } from '../src/components/SimulatorPanel/SimulatorPanel';

export default function OperatorConsolePage() {
  const operatorName = 'Operator Alpha';

  // Data fetching
  const { incidents, loading: loadingIncidents, error: incidentsError, refetch } = usePolledIncidents(4500);
  const { dts } = useDts();

  // Selection states
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedPoleId, setSelectedPoleId] = useState<string>('');
  const [simulatorPoles, setSimulatorPoles] = useState<PoleSummary[]>([]);

  // Automatically select first incident on load or if selected incident disappears
  useEffect(() => {
    // Avoid synchronous setState during render/effect to prevent cascading renders.
    // Schedule updates asynchronously so React can finish the current render pass.
    let t: number | NodeJS.Timeout | null = null;
    if (incidents.length > 0) {
      if (!selectedIncidentId || !incidents.some((i) => i.id === selectedIncidentId)) {
        t = setTimeout(() => setSelectedIncidentId(incidents[0].id), 0);
      }
    } else {
      t = setTimeout(() => setSelectedIncidentId(null), 0);
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (t) clearTimeout(t as any);
    };
  }, [incidents, selectedIncidentId]);

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null;

  const handleSelectIncident = (incident: IncidentRow) => {
    setSelectedIncidentId(incident.id);
  };

  const handleIncidentUpdated = (updated: IncidentRow) => {
    refetch();
    // If ticket was closed, deselect or select next available
    if (updated.status === 'closed' || updated.status === 'verified') {
      const remaining = incidents.filter((i) => i.id !== updated.id);
      setSelectedIncidentId(remaining.length > 0 ? remaining[0].id : null);
    } else {
      setSelectedIncidentId(updated.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Header Bar */}
      <Header incidents={incidents} operatorName={operatorName} />

      {/* 2. Main Two-Pane / Three-Column Layout */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--space-3)', gap: 'var(--space-3)', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr 420px', gap: 'var(--space-3)', minHeight: '520px', flex: 1 }}>
          {/* Left: Incident Queue */}
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <IncidentList
              incidents={incidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={handleSelectIncident}
              loading={loadingIncidents}
              error={incidentsError}
            />
          </div>

          {/* Center: GIS Network Map */}
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--panel-border)', position: 'relative' }}>
            <NetworkMap
              incidents={incidents}
              dts={dts}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={handleSelectIncident}
              simulatorPoles={simulatorPoles}
              selectedPoleId={selectedPoleId}
              onSelectPole={setSelectedPoleId}
            />
          </div>

          {/* Right: Selected Incident Detail & Operator Actions */}
          <div style={{ overflowY: 'auto' }}>
            <IncidentDetail
              incident={selectedIncident}
              operatorName={operatorName}
              onRefresh={refetch}
              onIncidentUpdated={handleIncidentUpdated}
            />
          </div>
        </div>

        {/* 3. Simulator Control Room (Visually Separated Test Tooling) */}
        <SimulatorPanel
          dts={dts}
          selectedIncident={selectedIncident}
          operatorName={operatorName}
          selectedPoleId={selectedPoleId}
          onSelectPole={setSelectedPoleId}
          onPolesLoaded={setSimulatorPoles}
          onActionComplete={refetch}
        />
      </main>
    </div>
  );
}
