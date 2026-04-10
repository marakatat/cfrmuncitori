"use client";

import dynamic from "next/dynamic";
import type { PolylineTrace, Station } from "@/lib/types";

const DynamicMapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

type Props = {
  stations: Station[];
  trainPosition: Station | null;
  currentStationId: string | null;
  traces: PolylineTrace[];
  optionTraces: PolylineTrace[];
  onStartHere: (station: Station) => void;
};

export default function RailwayMap(props: Props) {
  return <DynamicMapView {...props} />;
}
