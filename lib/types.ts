export type Station = {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
};

export type TripRoute = {
  route_id: string;
  agency_id: string | null;
  route_short_name: string | null;
  route_long_name: string | null;
  route_type: number | null;
};

export type DirectDestinationOption = {
  tripId: string;
  shapeId: string | null;
  serviceId: string;
  agency: string;
  trainId: string;
  routeLabel: string;
  startStationId: string;
  startStationName: string;
  endStationId: string;
  endStationName: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
};

export type PolylineTrace = {
  key: string;
  color: string;
  label?: string;
  points: [number, number][];
};

export type ItinerarySegment = {
  stepOrder: number;
  startStationId: string;
  startStationName: string;
  endStationId: string;
  endStationName: string;
  trainNumber: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  tripId: string;
  shapeId: string | null;
};

export type SavedRoute = {
  id: string;
  route_name: string;
  user_id: string;
};

export type StoredRouteSegment = {
  id: string;
  route_id: string;
  step_order: number;
  start_station_id: string;
  end_station_id: string;
  train_number: string;
  duration: string;
};
