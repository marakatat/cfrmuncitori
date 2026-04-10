"use client";

import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PolylineTrace, Station } from "@/lib/types";
import { useMemo } from "react";

type Props = {
  stations: Station[];
  trainPosition: Station | null;
  currentStationId: string | null;
  traces: PolylineTrace[];
  optionTraces: PolylineTrace[];
  onStartHere: (station: Station) => void;
};

const stationIcon = L.divIcon({
  className: "",
  html: '<div class="station-dot"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const trainIcon = L.divIcon({
  className: "",
  html: '<div class="train-icon">🚆</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FitRomaniaBounds() {
  const map = useMap();
  map.setView([45.9432, 24.9668], 7);
  return null;
}

export default function MapView({
  stations,
  trainPosition,
  currentStationId,
  traces,
  optionTraces,
  onStartHere,
}: Props) {
  const currentStationSet = useMemo(() => new Set(currentStationId ? [currentStationId] : []), [currentStationId]);

  return (
    <MapContainer className="h-[70vh] w-full rounded-xl border" center={[45.9432, 24.9668]} zoom={7}>
      <FitRomaniaBounds />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {optionTraces.map((trace) => (
        <Polyline key={trace.key} positions={trace.points} pathOptions={{ color: trace.color, weight: 4, opacity: 0.6 }}>
          {trace.label ? <Tooltip sticky>{trace.label}</Tooltip> : null}
        </Polyline>
      ))}

      {traces.map((trace) => (
        <Polyline key={trace.key} positions={trace.points} pathOptions={{ color: trace.color, weight: 5, opacity: 0.9 }}>
          {trace.label ? <Tooltip sticky>{trace.label}</Tooltip> : null}
        </Polyline>
      ))}

      {stations.map((station) => (
        <Marker key={station.stop_id} position={[station.stop_lat, station.stop_lon]} icon={stationIcon}>
          <Popup>
            <div className="space-y-2">
              <div className="font-semibold">{station.stop_name}</div>
              <button
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                onClick={() => onStartHere(station)}
              >
                Start here
              </button>
            </div>
          </Popup>
          {currentStationSet.has(station.stop_id) ? (
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              Current station
            </Tooltip>
          ) : null}
        </Marker>
      ))}

      {trainPosition ? <Marker position={[trainPosition.stop_lat, trainPosition.stop_lon]} icon={trainIcon} /> : null}
    </MapContainer>
  );
}
