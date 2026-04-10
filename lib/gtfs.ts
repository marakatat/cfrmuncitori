import { compactDate, dayField, formatDuration } from "@/lib/gtfs-time";
import { ensureAnonymousSession, supabase } from "@/lib/supabase";
import type {
  DirectDestinationOption,
  ItinerarySegment,
  PolylineTrace,
  SavedRoute,
  Station,
  StoredRouteSegment,
  TripRoute,
} from "@/lib/types";

type CalendarRow = {
  service_id: string;
};

type CalendarDateRow = {
  service_id: string;
  exception_type: number;
};

type StopTimeRow = {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
};

type TripRow = {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string | null;
  shape_id: string | null;
};

type ShapeRow = {
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
};

export async function fetchStations(hideRegio: boolean): Promise<Station[]> {
  let query = supabase
    .from("stops")
    .select("stop_id, stop_name, stop_lat, stop_lon")
    .order("stop_name");

  if (hideRegio) {
    query = query.not("stop_name", "ilike", "h.%").not("stop_name", "ilike", "hm.%").not("stop_name", "ilike", "hc.%");
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!hideRegio) return data as Station[];

  const regex = /\b(h|hm|hc)\./i;
  return (data as Station[]).filter((station) => !regex.test(station.stop_name));
}

export async function fetchActiveServiceIds(dateISO: string): Promise<Set<string>> {
  const dayColumn = dayField(dateISO);
  const yyyymmdd = compactDate(dateISO);

  const { data: calendarRows, error: calendarError } = await supabase
    .from("calendar")
    .select("service_id")
    .eq(dayColumn, 1)
    .lte("start_date", yyyymmdd)
    .gte("end_date", yyyymmdd);

  if (calendarError) throw calendarError;

  const active = new Set((calendarRows as CalendarRow[]).map((row) => row.service_id));

  const { data: exceptions, error: exceptionError } = await supabase
    .from("calendar_dates")
    .select("service_id, exception_type")
    .eq("date", yyyymmdd);

  if (exceptionError) throw exceptionError;

  for (const row of (exceptions as CalendarDateRow[]) ?? []) {
    if (row.exception_type === 1) active.add(row.service_id);
    if (row.exception_type === 2) active.delete(row.service_id);
  }

  return active;
}

function toTrainLabel(route: TripRoute, trip: TripRow): string {
  const short = route.route_short_name?.trim();
  if (short) return short;
  return trip.trip_id;
}

function toRouteLabel(route: TripRoute): string {
  if (route.route_long_name?.trim()) return route.route_long_name;
  if (route.route_short_name?.trim()) return route.route_short_name;
  return route.route_id;
}

export async function fetchDirectDestinationsFromStation(
  startStationId: string,
  dateISO: string,
  stationsById: Map<string, Station>
): Promise<DirectDestinationOption[]> {
  const activeServices = await fetchActiveServiceIds(dateISO);

  const { data: departures, error: departuresError } = await supabase
    .from("stop_times")
    .select("trip_id, arrival_time, departure_time, stop_id, stop_sequence")
    .eq("stop_id", startStationId);

  if (departuresError) throw departuresError;

  const startRows = (departures as StopTimeRow[]).filter((row) => row.departure_time);
  if (startRows.length === 0) return [];

  const tripIds = [...new Set(startRows.map((row) => row.trip_id))];

  const { data: tripsData, error: tripsError } = await supabase
    .from("trips")
    .select("trip_id, route_id, service_id, trip_headsign, shape_id")
    .in("trip_id", tripIds);

  if (tripsError) throw tripsError;

  const trips = (tripsData as TripRow[]).filter((trip) => activeServices.has(trip.service_id));
  if (trips.length === 0) return [];

  const filteredTripIds = trips.map((trip) => trip.trip_id);
  const routeIds = [...new Set(trips.map((trip) => trip.route_id))];

  const [{ data: routes, error: routesError }, { data: allStopTimes, error: allStopTimesError }] =
    await Promise.all([
      supabase
        .from("routes")
        .select("route_id, agency_id, route_short_name, route_long_name, route_type")
        .in("route_id", routeIds),
      supabase
        .from("stop_times")
        .select("trip_id, arrival_time, departure_time, stop_id, stop_sequence")
        .in("trip_id", filteredTripIds)
        .order("trip_id")
        .order("stop_sequence"),
    ]);

  if (routesError) throw routesError;
  if (allStopTimesError) throw allStopTimesError;

  const routeById = new Map((routes as TripRoute[]).map((route) => [route.route_id, route]));
  const tripById = new Map(trips.map((trip) => [trip.trip_id, trip]));
  const startByTrip = new Map(startRows.map((row) => [row.trip_id, row]));

  const groupedStops = new Map<string, StopTimeRow[]>();
  for (const stop of allStopTimes as StopTimeRow[]) {
    const existing = groupedStops.get(stop.trip_id);
    if (existing) existing.push(stop);
    else groupedStops.set(stop.trip_id, [stop]);
  }

  const options: DirectDestinationOption[] = [];

  for (const [tripId, orderedStops] of groupedStops) {
    const trip = tripById.get(tripId);
    const start = startByTrip.get(tripId);
    if (!trip || !start) continue;

    const route = routeById.get(trip.route_id);
    if (!route) continue;

    for (const stop of orderedStops) {
      if (stop.stop_sequence <= start.stop_sequence) continue;
      if (!stationsById.has(stop.stop_id)) continue;

      const destination = stationsById.get(stop.stop_id)!;
      const origin = stationsById.get(start.stop_id);

      options.push({
        tripId,
        shapeId: trip.shape_id,
        serviceId: trip.service_id,
        agency: route.agency_id ?? "N/A",
        trainId: toTrainLabel(route, trip),
        routeLabel: toRouteLabel(route),
        startStationId: start.stop_id,
        startStationName: origin?.stop_name ?? start.stop_id,
        endStationId: destination.stop_id,
        endStationName: destination.stop_name,
        departureTime: start.departure_time,
        arrivalTime: stop.arrival_time,
        duration: formatDuration(start.departure_time, stop.arrival_time),
      });
    }
  }

  return options.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}

function closestShapePointIndex(points: ShapeRow[], station: Station): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const p = points[index];
    const dLat = p.shape_pt_lat - station.stop_lat;
    const dLon = p.shape_pt_lon - station.stop_lon;
    const d = dLat * dLat + dLon * dLon;
    if (d < distance) {
      distance = d;
      best = index;
    }
  }

  return best;
}

export async function fetchShapeSegmentForTrip(
  tripId: string,
  startStation: Station,
  endStation: Station,
  color: string,
  key: string,
  label?: string
): Promise<PolylineTrace | null> {
  const { data: tripData, error: tripError } = await supabase
    .from("trips")
    .select("shape_id")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (tripError) throw tripError;
  if (!tripData?.shape_id) return null;

  const { data: shapeData, error: shapeError } = await supabase
    .from("shapes")
    .select("shape_pt_lat, shape_pt_lon, shape_pt_sequence")
    .eq("shape_id", tripData.shape_id)
    .order("shape_pt_sequence", { ascending: true });

  if (shapeError) throw shapeError;

  const points = (shapeData as ShapeRow[]) ?? [];
  if (points.length < 2) return null;

  const startIdx = closestShapePointIndex(points, startStation);
  const endIdx = closestShapePointIndex(points, endStation);

  const min = Math.min(startIdx, endIdx);
  const max = Math.max(startIdx, endIdx);

  const sliced = points.slice(min, max + 1).map((p) => [p.shape_pt_lat, p.shape_pt_lon] as [number, number]);
  if (sliced.length < 2) return null;

  return {
    key,
    color,
    label,
    points: sliced,
  };
}

export async function saveRoute(routeName: string, itinerary: ItinerarySegment[]): Promise<string> {
  await ensureAnonymousSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No anonymous user session available");
  }

  const { data: route, error: routeError } = await supabase
    .from("saved_routes")
    .insert({ route_name: routeName, user_id: user.id })
    .select("id")
    .single();

  if (routeError) throw routeError;

  const segments = itinerary.map((segment, index) => ({
    route_id: route.id,
    step_order: index + 1,
    start_station_id: segment.startStationId,
    end_station_id: segment.endStationId,
    train_number: segment.trainNumber,
    duration: segment.duration,
  }));

  const { error: segmentError } = await supabase.from("route_segments").insert(segments);
  if (segmentError) throw segmentError;

  return route.id;
}

export async function fetchRouteById(routeId: string): Promise<{
  route: SavedRoute;
  segments: StoredRouteSegment[];
}> {
  const [{ data: route, error: routeError }, { data: segments, error: segmentsError }] = await Promise.all([
    supabase.from("saved_routes").select("id, route_name, user_id").eq("id", routeId).single(),
    supabase
      .from("route_segments")
      .select("id, route_id, step_order, start_station_id, end_station_id, train_number, duration")
      .eq("route_id", routeId)
      .order("step_order"),
  ]);

  if (routeError) throw routeError;
  if (segmentsError) throw segmentsError;

  return { route: route as SavedRoute, segments: segments as StoredRouteSegment[] };
}
