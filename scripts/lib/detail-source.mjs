// Preserve differing outcomes/geographies as distinct source records. A missing
// case ID makes this expression null; those rows are retained individually.
export const inspectionEventKey =
  "job_id || '|' || inspection_date::text || '|' || coalesce(inspection_type,'') || '|' || coalesce(bbl::text,'') || '|' || coalesce(result,'') || '|' || coalesce(borough,'') || '|' || coalesce(zip_code,'')";
export const inspectionRecordCount = `(count(distinct ${inspectionEventKey}) + count(*) - count(job_id))`;
export function inspectionWhere(from, to) {
  return `inspection_date >= '${from}T00:00:00' AND inspection_date < '${to}T00:00:00'`;
}
export function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400_000)
    .toISOString()
    .slice(0, 10);
}
