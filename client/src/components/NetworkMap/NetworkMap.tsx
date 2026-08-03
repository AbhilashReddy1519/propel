import dynamic from 'next/dynamic';
import React from 'react';
import { IncidentRow, DtSummary, PoleSummary } from '../../types/api';

interface NetworkMapProps {
  incidents: IncidentRow[];
  dts: DtSummary[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: IncidentRow) => void;
  simulatorPoles?: PoleSummary[];
  selectedPoleId?: string;
  onSelectPole?: (poleId: string) => void;
}

const DynamicMap = dynamic(() => import('./NetworkMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#091424',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}
    >
      <span>🗺️ Loading GIS Map & Network Topology...</span>
    </div>
  ),
});

export const NetworkMap: React.FC<NetworkMapProps> = (props) => {
  return <DynamicMap {...props} />;
};
