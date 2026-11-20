// Readings as the stations send them: one line each, "station,hour,millimetres".

export function parseReadings(text) {
  const readings = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [station, hour, mm] = trimmed.split(',');
    readings.push({ station: station.trim(), hour: Number(hour), mm: Number(mm) });
  }
  return readings;
}

export function forStation(readings, station) {
  return readings.filter((r) => r.station === station);
}
