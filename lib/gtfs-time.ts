const GTFS_TIME = /^(\d{1,3}):(\d{2}):(\d{2})$/;

export function gtfsTimeToSeconds(value: string): number {
  const match = value.match(GTFS_TIME);
  if (!match) {
    throw new Error(`Invalid GTFS time: ${value}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if (minutes > 59 || seconds > 59) {
    throw new Error(`Invalid GTFS time: ${value}`);
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(from: string, to: string): string {
  const start = gtfsTimeToSeconds(from);
  let end = gtfsTimeToSeconds(to);

  if (end < start) {
    end += 24 * 3600;
  }

  const total = end - start;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function compactDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

export function dayField(dateISO: string):
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday" {
  const [year, month, dayOfMonth] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return dayNames[day];
}
