import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type IncidentStatus =
  | 'detected'
  | 'acknowledged'
  | 'crew_assigned'
  | 'resolved'
  | 'verified'
  | 'closed';

type IncidentConfidence = 'high' | 'inferred' | 'range';

type IncidentRow = {
  id: string;
  dtId: string;
  frontierParentPoleId: string | null;
  frontierChildPoleId: string | null;
  status: IncidentStatus;
  confidence: IncidentConfidence;
  affectedPoleCount: number;
  lat: number;
  lon: number;
  pincode: string | null;
  reasoning: string;
  suppressedBySchedule: boolean;
  createdAt: string;
  resolvedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
};

type SimulatorResponse = {
  success?: boolean;
  description?: string;
  message?: string;
  incidentId?: string;
  repairedDeviceCount?: number;
};

const API_BASE = 'http://localhost:3000/api/v1';
const DEFAULT_CENTER: LatLngExpression = [12.97, 77.59];

function statusTone(status: IncidentStatus) {
  switch (status) {
    case 'verified':
    case 'closed':
      return 'good';
    case 'resolved':
      return 'warn';
    case 'crew_assigned':
      return 'alt';
    default:
      return 'danger';
  }
}

function confidenceLabel(confidence: IncidentConfidence) {
  switch (confidence) {
    case 'high':
      return 'Known';
    case 'inferred':
      return 'Inferred';
    default:
      return 'Range';
  }
}

export default function App() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [operatorName] = useState('Ops Lead');

  const selectedIncident = useMemo(
    () => incidents.find((item) => item.id === selectedId) ?? incidents[0] ?? null,
    [incidents, selectedId],
  );

  const activeIncidents = useMemo(
    () => incidents.filter((item) => !['verified', 'closed'].includes(item.status)),
    [incidents],
  );

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${API_BASE}/incidents?open=true`);
      if (!response.ok) throw new Error('Unable to load incidents');
      const data = (await response.json()) as IncidentRow[];
      setIncidents(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void fetchIncidents();
    const interval = window.setInterval(() => {
      void fetchIncidents();
    }, 4500);
    return () => window.clearInterval(interval);
  }, []);

  const triggerAction = async (path: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json()) as SimulatorResponse;
      if (!response.ok) {
        throw new Error(data?.message ?? 'Request failed');
      }
      setBanner(data.description ?? data.message ?? 'Action completed');
      await fetchIncidents();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      setBanner(message);
    } finally {
      setBusy(false);
    }
  };

  const handleInjectFault = async () => {
    await triggerAction('/sim/inject-fault', {
      type: 'span',
      dtId: 'D-0101',
      targetId: 'P-000002',
    });
  };

  const handleInjectNoise = async () => {
    await triggerAction('/sim/inject-noise', {
      dtId: 'D-0101',
      noiseType: 'single_sensor_failure',
    });
  };

  const handleRepair = async () => {
    if (!selectedIncident) return;
    await triggerAction(`/sim/repair/${selectedIncident.id}`, {
      actor: operatorName,
      note: 'Operator restored service from console',
    });
  };

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PROPEL • Operator Console</p>
          <h1>Faults, tickets, and recovery in one glance.</h1>
          <p className="lead">
            Live incident feed for the control room with a map, confidence reasoning, and
            one-click simulator actions.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-label">Active</span>
            <strong>{activeIncidents.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Severity</span>
            <strong>{activeIncidents.length ? 'High' : 'Stable'}</strong>
          </div>
        </div>
      </header>

      {banner ? <div className="banner">{banner}</div> : null}

      <section className="controls">
        <button onClick={handleInjectFault} disabled={busy}>
          {busy ? 'Working…' : 'Inject fault'}
        </button>
        <button onClick={handleInjectNoise} disabled={busy}>
          Inject noise
        </button>
        <button onClick={handleRepair} disabled={busy || !selectedIncident}>
          Repair selected
        </button>
      </section>

      <section className="grid">
        <div className="panel list-panel">
          <div className="panel-header">
            <h2>Incident queue</h2>
            <span>{incidents.length} total</span>
          </div>
          <div className="incident-list">
            {incidents.length === 0 ? (
              <div className="empty-state">
                No incidents yet. Inject a fault to kick off the workflow.
              </div>
            ) : (
              incidents.map((incident) => (
                <button
                  key={incident.id}
                  className={`incident-item ${selectedIncident?.id === incident.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(incident.id)}
                >
                  <div className="incident-topline">
                    <span className={`pill ${statusTone(incident.status)}`}>{incident.status}</span>
                    <span className="muted">
                      {new Date(incident.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <strong>{incident.dtId}</strong>
                  <div className="incident-meta">
                    <span>{incident.affectedPoleCount} poles</span>
                    <span>{confidenceLabel(incident.confidence)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel map-panel">
          <div className="panel-header">
            <h2>Network map</h2>
            <span>Live location of each ticket</span>
          </div>
          <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {incidents.map((incident) => (
              <Marker key={incident.id} position={[incident.lat, incident.lon]}>
                <Popup>
                  <strong>{incident.dtId}</strong>
                  <br />
                  {incident.reasoning}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      {selectedIncident ? (
        <section className="panel detail-panel">
          <div className="panel-header">
            <h2>Incident details</h2>
            <span>{selectedIncident.id.slice(0, 8)}…</span>
          </div>
          <div className="detail-grid">
            <div>
              <h3>Asset</h3>
              <p>{selectedIncident.dtId}</p>
            </div>
            <div>
              <h3>Span / boundary</h3>
              <p>{selectedIncident.frontierChildPoleId ?? 'n/a'}</p>
            </div>
            <div>
              <h3>Coordinates</h3>
              <p>
                {selectedIncident.lat.toFixed(4)}, {selectedIncident.lon.toFixed(4)}
              </p>
            </div>
            <div>
              <h3>PIN</h3>
              <p>{selectedIncident.pincode ?? 'unknown'}</p>
            </div>
            <div>
              <h3>Households affected</h3>
              <p>{selectedIncident.affectedPoleCount}</p>
            </div>
            <div>
              <h3>Confidence</h3>
              <p>{confidenceLabel(selectedIncident.confidence)}</p>
            </div>
          </div>
          <div className="reason-box">
            <h3>Operator reasoning</h3>
            <p>{selectedIncident.reasoning}</p>
          </div>
          <div className="timeline">
            <h3>Status timeline</h3>
            <ul>
              <li>Status: {selectedIncident.status}</li>
              <li>Created: {new Date(selectedIncident.createdAt).toLocaleString()}</li>
              {selectedIncident.resolvedAt ? (
                <li>Resolved: {new Date(selectedIncident.resolvedAt).toLocaleString()}</li>
              ) : null}
              {selectedIncident.verifiedAt ? (
                <li>Verified: {new Date(selectedIncident.verifiedAt).toLocaleString()}</li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
