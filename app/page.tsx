"use client";

import { useEffect, useMemo, useState } from "react";
import RailwayMap from "@/components/map/RailwayMap";
import ItineraryList from "@/components/ui/ItineraryList";
import WhereToMenu from "@/components/ui/WhereToMenu";
import {
  fetchDirectDestinationsFromStation,
  fetchShapeSegmentForTrip,
  fetchStations,
  saveRoute,
} from "@/lib/gtfs";
import type { DirectDestinationOption, ItinerarySegment, PolylineTrace, Station } from "@/lib/types";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function HomePage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [hideRegio, setHideRegio] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [trainPosition, setTrainPosition] = useState<Station | null>(null);
  const [options, setOptions] = useState<DirectDestinationOption[]>([]);
  const [itinerary, setItinerary] = useState<ItinerarySegment[]>([]);
  const [traces, setTraces] = useState<PolylineTrace[]>([]);
  const [optionTraces, setOptionTraces] = useState<PolylineTrace[]>([]);
  const [saving, setSaving] = useState(false);

  const stationById = useMemo(() => new Map(stations.map((station) => [station.stop_id, station])), [stations]);

  useEffect(() => {
    fetchStations(hideRegio)
      .then(setStations)
      .catch((error) => console.error(error));
  }, [hideRegio]);

  useEffect(() => {
    if (!currentStation) {
      setOptions([]);
      setOptionTraces([]);
      return;
    }

    fetchDirectDestinationsFromStation(currentStation.stop_id, selectedDate, stationById)
      .then(async (nextOptions) => {
        setOptions(nextOptions);

        const sampled = nextOptions.slice(0, 8);
        const tracePromises = sampled.map(async (option, index) => {
          const start = stationById.get(option.startStationId);
          const end = stationById.get(option.endStationId);
          if (!start || !end) return null;

          return fetchShapeSegmentForTrip(
            option.tripId,
            start,
            end,
            COLORS[index % COLORS.length],
            `candidate-${option.tripId}-${option.endStationId}`,
            option.endStationName
          );
        });

        const resolved = await Promise.all(tracePromises);
        setOptionTraces(resolved.filter((trace): trace is PolylineTrace => Boolean(trace)));
      })
      .catch((error) => console.error(error));
  }, [currentStation, selectedDate, stationById]);

  const onStartHere = (station: Station) => {
    setCurrentStation(station);
    setTrainPosition(station);
    setItinerary([]);
    setTraces([]);
  };

  const onChoose = async (option: DirectDestinationOption) => {
    if (!currentStation) return;

    const nextStation = stationById.get(option.endStationId);
    if (!nextStation) return;

    const segment: ItinerarySegment = {
      stepOrder: itinerary.length + 1,
      startStationId: option.startStationId,
      startStationName: option.startStationName,
      endStationId: option.endStationId,
      endStationName: option.endStationName,
      trainNumber: option.trainId,
      departureTime: option.departureTime,
      arrivalTime: option.arrivalTime,
      duration: option.duration,
      tripId: option.tripId,
      shapeId: option.shapeId,
    };

    const trace = await fetchShapeSegmentForTrip(
      option.tripId,
      currentStation,
      nextStation,
      "#2563eb",
      `trace-${segment.stepOrder}-${option.tripId}`,
      `${option.startStationName} → ${option.endStationName}`
    );

    setItinerary((prev) => [...prev, segment]);
    if (trace) {
      setTraces((prev) => [...prev, trace]);
    }

    setCurrentStation(nextStation);
    setTrainPosition(nextStation);
  };

  const onSaveRoute = async () => {
    if (itinerary.length === 0 || saving) return;

    try {
      setSaving(true);
      const first = itinerary[0];
      const last = itinerary[itinerary.length - 1];
      const routeId = await saveRoute(
        `${first.startStationName} → ${last.endStationName} (${new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, 16)})`,
        itinerary
      );
      window.open(`/custom_route/${routeId}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert("Failed to save route.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold">Romanian Railway Route Planner</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hideRegio}
                onChange={(e) => setHideRegio(e.target.checked)}
              />
              Hide Regio Stations
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              Travel date
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded border px-2 py-1"
              />
            </label>

            <button
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={onSaveRoute}
              disabled={itinerary.length === 0 || saving}
            >
              {saving ? "Saving..." : "Save Route"}
            </button>
          </div>
        </header>

        <RailwayMap
          stations={stations}
          trainPosition={trainPosition}
          currentStationId={currentStation?.stop_id ?? null}
          traces={traces}
          optionTraces={optionTraces}
          onStartHere={onStartHere}
        />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WhereToMenu options={options} onChoose={onChoose} />
          <ItineraryList itinerary={itinerary} />
        </section>
      </div>
    </main>
  );
}
