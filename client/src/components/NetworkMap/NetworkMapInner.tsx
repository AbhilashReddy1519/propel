import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { IncidentRow, DtSummary, PoleSummary } from '../../types/api';
import { STATUS_STYLE } from '../../utils/statusStyles';

interface NetworkMapInnerProps {
  incidents: IncidentRow[];
  dts: DtSummary[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: IncidentRow) => void;
  simulatorPoles?: PoleSummary[];
  selectedPoleId?: string;
  selectedDtId?: string;
  onSelectPole?: (poleId: string) => void;
}

// Recenter component that ONLY moves map when selectedIncidentId changes or on initial load,
// preventing annoying view resets during 4.5s background polling.
const MapRecenter: React.FC<{ selectedIncidentId: string | null; center: [number, number]; zoom?: number }> = ({
  selectedIncidentId,
  center,
  zoom,
}) => {
  const map = useMap();
  const prevIdRef = useRef<string | null>(null);
  const initialCenteredRef = useRef<boolean>(false);

  useEffect(() => {
    // Initial centering once on mount
    if (!initialCenteredRef.current && center && center[0] && center[1]) {
      map.setView(center, zoom || 13);
      initialCenteredRef.current = true;
      prevIdRef.current = selectedIncidentId;
      return;
    }

    // Only recenter when operator selects a DIFFERENT incident
    if (selectedIncidentId && selectedIncidentId !== prevIdRef.current && center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
      prevIdRef.current = selectedIncidentId;
    }
  }, [selectedIncidentId, center, zoom, map]);

  return null;
};

// Custom SVG icon generator for Incident Markers
const createIncidentIcon = (color: string, isSelected: boolean) => {
  const size = isSelected ? 32 : 24;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="${color}"/>
      ${isSelected ? `<circle cx="12" cy="12" r="11" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,2"/>` : ''}
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-incident-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const NetworkMapInner: React.FC<NetworkMapInnerProps> = ({
  incidents,
  dts,
  selectedIncidentId,
  onSelectIncident,
  simulatorPoles = [],
  selectedPoleId,
  selectedDtId,
  onSelectPole,
}) => {
  // Default center (Bangalore / India coordinates fallback)
  const defaultCenter: [number, number] = [12.9716, 77.5946];

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);
  const activeCenter: [number, number] = selectedIncident
    ? [selectedIncident.lat, selectedIncident.lon]
    : incidents.length > 0
    ? [incidents[0].lat, incidents[0].lon]
    : dts.length > 0
    ? [dts[0].lat, dts[0].lon]
    : defaultCenter;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={activeCenter}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <MapRecenter selectedIncidentId={selectedIncidentId} center={activeCenter} />

        {/* Dark map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Background DT Transformer Markers (Distinct Cyan/Teal color with hover tooltips) */}
        {dts.map((dt) => (
          <CircleMarker
            key={`dt-bg-${dt.id}`}
            center={[dt.lat, dt.lon]}
            radius={5}
            pathOptions={{
              color: '#0284c7', // Cyan border
              fillColor: '#38bdf8', // Distinct Cyan fill
              fillOpacity: 0.9,
              weight: 1.5,
            }}
          >
            {/* Hover Tooltip showing Transformer ID */}
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95} sticky>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f1e34' }}>
                ⚡ Transformer (DT): <strong>{dt.id}</strong>
                <br />
                Feeder: {dt.feederId} | Poles: {dt.poleCount} | Capacity: {dt.capacityKva} kVA
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Simulator Target Poles Context with Hover Tooltips showing Pole ID & Transformer ID */}
        {simulatorPoles.map((pole) => {
          const isPoleSelected = pole.id === selectedPoleId;
          return (
            <CircleMarker
              key={`pole-sim-${pole.id}`}
              center={[pole.lat, pole.lon]}
              radius={isPoleSelected ? 7 : 5}
              pathOptions={{
                color: isPoleSelected ? '#FFC46B' : '#d97706',
                fillColor: isPoleSelected ? '#FFC46B' : '#fbbf24',
                fillOpacity: isPoleSelected ? 1 : 0.7,
                weight: isPoleSelected ? 2 : 1,
              }}
              eventHandlers={{
                click: () => onSelectPole && onSelectPole(pole.id),
              }}
            >
              {/* Hover Tooltip displaying Transformer ID & Pole ID */}
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95} sticky>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f1e34' }}>
                  📍 Pole ID: <strong>{pole.id}</strong>
                  <br />
                  Transformer (DT): <strong>{selectedDtId || 'N/A'}</strong>
                  <br />
                  Device Attached: {pole.hasDevice ? 'Yes' : 'No'}
                </div>
              </Tooltip>

              <Popup>
                <div style={{ fontSize: '12px' }}>
                  <strong>Pole: {pole.id}</strong>
                  <br />
                  Transformer: <strong>{selectedDtId || 'N/A'}</strong>
                  <br />
                  Device: {pole.hasDevice ? 'Yes' : 'No'}
                  <br />
                  {onSelectPole && (
                    <button
                      onClick={() => onSelectPole(pole.id)}
                      style={{
                        marginTop: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#6b4a1a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Select as Simulator Target
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Active Incident Markers */}
        {incidents.map((incident) => {
          const isSelected = incident.id === selectedIncidentId;
          const statusStyle = STATUS_STYLE[incident.status] || STATUS_STYLE.detected;
          const icon = createIncidentIcon(statusStyle.fg, isSelected);

          return (
            <Marker
              key={`incident-${incident.id}`}
              position={[incident.lat, incident.lon]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectIncident(incident),
              }}
            >
              {/* Hover Tooltip showing Incident & DT Transformer details */}
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95} sticky>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f1e34' }}>
                  ⚠️ Incident {incident.id.slice(0, 8)}...
                  <br />
                  Transformer (DT): <strong>{incident.dtId}</strong>
                  <br />
                  Status: <strong>{statusStyle.label}</strong>
                </div>
              </Tooltip>

              <Popup>
                <div style={{ fontSize: '12px', minWidth: '160px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    DT: {incident.dtId}
                  </div>
                  <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', background: statusStyle.bg, color: statusStyle.fg, fontWeight: 600, fontSize: '11px', marginBottom: '6px' }}>
                    {statusStyle.label}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Poles: <strong>{incident.affectedPoleCount}</strong>
                    <br />
                    Conf: <strong>{incident.confidence}</strong>
                  </div>
                  <button
                    onClick={() => onSelectIncident(incident)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: 'var(--panel-border)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 1000,
          backgroundColor: 'rgba(7, 17, 31, 0.88)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          backdropFilter: 'blur(8px)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Map Legend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8', border: '1px solid #0284c7' }} />
          <span>Transformer (DT Context) ({dts.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fbbf24', border: '1px solid #d97706' }} />
          <span>Target Pole (Sim Context)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--status-detected-fg)' }} />
          <span>Detected Incident</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--status-crew-assigned-fg)' }} />
          <span>Crew Assigned</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkMapInner;
