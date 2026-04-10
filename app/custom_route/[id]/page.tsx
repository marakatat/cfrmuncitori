"use client";

import { useEffect, useMemo, useState } from "react";
import RailwayMap from "@/components/map/RailwayMap";
import ItineraryList from "@/components/ui/ItineraryList";
import { fetchRouteById, fetchShapeSegmentForTrip, fetchStations } from "@/lib/gtfs";
import type { ItinerarySegment, PolylineTrace, Station } from "@/lib/types";

export default function CustomRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const [routeId, setRouteId] = useState<string>("");
  const [stations, setStations] = useState<Station[]>([]);
  const [itinerary, setItinerary] = useState<ItinerarySegment[]>([]);
  const [traces, setTraces] = useState<PolylineTrace[]>([]);
  const [trainPosition, setTrainPosition] = useState<Station | null>(null);
  const [title, setTitle] = useState("Shared route");

  const stationById = useMemo(() => new Map(stations.map((station) => [station.stop_id, station])), [stations]);

  useEffect(() => {
    params.then((value) => setRouteId(value.id));
  }, [params]);

  useEffect(() => {
    fetchStations(false)
      .then(setStations)
      .catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    if (!routeId || stationById.size === 0) return;

    fetchRouteById(routeId)
      .then(async ({ route, segments }) => {
        setTitle(route.route_name);

        const normalized: ItinerarySegment[] = segments.map((segment, index) => ({
          stepOrder: segment.step_order,
          startStationId: segment.start_station_id,
          startStationName: stationById.get(segment.start_station_id)?.stop_name ?? segment.start_station_id,
          endStationId: segment.end_station_id,
          endStationName: stationById.get(segment.end_station_id)?.stop_name ?? segment.end_station_id,
          trainNumber: segment.train_number,
          departureTime: "--:--:--",
          arrivalTime: "--:--:--",
          duration: segment.duration,
          tripId: `${segment.train_number}-${index}`,
          shapeId: null,
        }));

        setItinerary(normalized);

        const segmentTraces = await Promise.all(
          normalized.map(async (segment, index) => {
            const start = stationById.get(segment.startStationId);
            const end = stationById.get(segment.endStationId);
            if (!start || !end) return null;

            const directTrip = await tryResolveTripForSegment(
              segment.startStationId,
              segment.endStationId,
              segment.trainNumber
            );

            if (!directTrip) return null;

            return fetchShapeSegmentForTrip(
              directTrip,
              start,
              end,
              "#2563eb",
              `saved-${index}`,
              `${segment.startStationName} → ${segment.endStationName}`
            );
          })
        );

        setTraces(segmentTraces.filter((trace): trace is PolylineTrace => Boolean(trace)));

        const last = normalized.at(-1);
        if (last) {
          const end = stationById.get(last.endStationId);
          if (end) setTrainPosition(end);
        }
      })
      .catch((error) => console.error(error));
  }, [routeId, stationById]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-600">Shareable route ID: {routeId}</p>
        </header>

        <RailwayMap
          stations={stations}
          trainPosition={trainPosition}
          currentStationId={trainPosition?.stop_id ?? null}
          traces={traces}
          optionTraces={[]}
          onStartHere={() => {
            // Read-only shared view.
          }}
        />

        <ItineraryList itinerary={itinerary} />
      </div>
    </main>
  );
}

async function tryResolveTripForSegment(
  startStationId: string,
  endStationId: string,
  trainNumber: string
): Promise<string | null> {
  const { supabase } = await import("@/lib/supabase");

  const { data: candidates, error } = await supabase
    .from("stop_times")
    .select("trip_id, stop_id, stop_sequence")
    .in("stop_id", [startStationId, endStationId]);

  if (error) {
    console.error(error);
    return null;
  }

  const grouped = new Map<string, { start?: number; end?: number }>();
  for (const row of candidates ?? []) {
    const item = grouped.get(row.trip_id) ?? {};
    if (row.stop_id === startStationId) item.start = row.stop_sequence;
    if (row.stop_id === endStationId) item.end = row.stop_sequence;
    grouped.set(row.trip_id, item);
  }

  const hasValidStopOrder = (value: { start?: number; end?: number }) =>
    value.start !== undefined && value.end !== undefined && value.end > value.start;

  const ordered = [...grouped.entries()].filter(([, value]) => hasValidStopOrder(value));
  if (ordered.length === 0) return null;

  const tripIds = ordered.map(([tripId]) => tripId);
  const { data: trips, error: tripError } = await supabase
    .from("trips")
    .select("trip_id, route_id")
    .in("trip_id", tripIds);

  if (tripError || !trips) return ordered[0][0];

  const routeIds = [...new Set(trips.map((t) => t.route_id))];
  const { data: routes } = await supabase
    .from("routes")
    .select("route_id, route_short_name")
    .in("route_id", routeIds);

  const routeById = new Map((routes ?? []).map((route) => [route.route_id, route.route_short_name]));

  for (const trip of trips) {
    if (routeById.get(trip.route_id) === trainNumber) {
      return trip.trip_id;
    }
  }

  return ordered[0][0];
}
