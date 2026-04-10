import type { DirectDestinationOption } from "@/lib/types";

type Props = {
  options: DirectDestinationOption[];
  onChoose: (option: DirectDestinationOption) => void;
};

export default function WhereToMenu({ options, onChoose }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Where To</h2>
      <div className="mt-3 max-h-[45vh] space-y-3 overflow-auto pr-1">
        {options.length === 0 ? <p className="text-sm text-slate-500">No direct destinations for the selected date.</p> : null}
        {options.map((option, index) => (
          <button
            key={`${option.tripId}-${option.endStationId}-${index}`}
            className="w-full rounded-lg border p-3 text-left hover:bg-slate-50"
            onClick={() => onChoose(option)}
          >
            <div className="text-sm font-semibold">{option.endStationName}</div>
            <div className="mt-1 text-xs text-slate-600">Agency: {option.agency}</div>
            <div className="text-xs text-slate-600">Train: {option.trainId}</div>
            <div className="text-xs text-slate-600">Route: {option.routeLabel}</div>
            <div className="text-xs text-slate-600">
              {option.startStationName} {option.departureTime} → {option.endStationName} {option.arrivalTime}
            </div>
            <div className="text-xs text-slate-600">Duration: {option.duration}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
