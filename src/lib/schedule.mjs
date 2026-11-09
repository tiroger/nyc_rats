// The weekly data refresh is scheduled Mondays at 10:23 UTC (see
// .github/workflows/pages.yml).
export function untilRefresh(now) {
  const next = new Date(now);
  next.setUTCHours(10, 23, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  const minutes = Math.ceil((next - now) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days} ${days === 1 ? "day" : "days"} ${hours} hr`;
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}
