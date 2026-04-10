import type { ItinerarySegment } from "@/lib/types";

type Props = {
  itinerary: ItinerarySegment[];
};

export default function ItineraryList({ itinerary }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Itinerary</h2>
      <ol className="mt-3 space-y-2">
        {itinerary.length === 0 ? <li className="text-sm text-slate-500">No segments selected yet.</li> : null}
        {itinerary.map((segment) => (
          <li key={`${segment.tripId}-${segment.stepOrder}`} className="rounded-lg border p-3 text-sm">
            <div className="font-semibold">{segment.trainNumber}</div>
            <div className="text-slate-600">
              {segment.startStationName} {segment.departureTime} → {segment.endStationName} {segment.arrivalTime}
            </div>
            <div className="text-slate-600">Duration: {segment.duration}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
