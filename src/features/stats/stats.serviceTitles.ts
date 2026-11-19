export interface StatsServiceLine {
  service_id: number | null;
  title_snapshot: string | null;
}

export function resolveStatsServiceTitles(
  appointmentServiceId: number | null,
  lines: StatsServiceLine[] | null,
  catalog: ReadonlyMap<number, string>,
) {
  const saved = lines ?? [];
  if (saved.length > 0) {
    return saved
      .map((line) => {
        const snapshot = line.title_snapshot?.trim();
        if (snapshot) return snapshot;
        if (line.service_id == null) return '';
        return catalog.get(line.service_id)?.trim() ?? '';
      })
      .filter(Boolean);
  }

  if (appointmentServiceId == null) return [];
  const title = catalog.get(appointmentServiceId)?.trim();
  return title ? [title] : [];
}
