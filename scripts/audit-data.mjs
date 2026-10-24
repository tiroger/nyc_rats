import { readFile } from "node:fs/promises";
import {
  SOURCE_IDS,
  validateSnapshot,
  summarize,
  periodMetrics,
  presetRange,
} from "../src/lib/data.mjs";
import { query, sourceWhere } from "./lib/socrata.mjs";
import { verifySourceAudit } from "./lib/audit.mjs";

const snapshot = JSON.parse(
  await readFile(
    new URL("../public/data/sightings.json", import.meta.url),
    "utf8",
  ),
);
validateSnapshot(snapshot);

await Promise.all(
  SOURCE_IDS.map(async (id) => {
    const where = sourceWhere(id);
    const [totals, monthlyBorough, monthlyZip] = await Promise.all([
      query(id, {
        $select:
          "count(*) as reports,count(distinct unique_key) as distinct_reports",
        $where: where,
      }),
      query(id, {
        $select:
          "date_trunc_ym(created_date) as month,borough,count(*) as reports",
        $where: where,
        $group: "date_trunc_ym(created_date),borough",
        $limit: "50000",
      }),
      query(id, {
        $select:
          "date_trunc_ym(created_date) as month,incident_zip,count(*) as reports",
        $where: where,
        $group: "date_trunc_ym(created_date),incident_zip",
        $limit: "50000",
      }),
    ]);
    if (
      !Array.isArray(totals) ||
      totals.length !== 1 ||
      !Array.isArray(monthlyBorough) ||
      !Array.isArray(monthlyZip)
    )
      throw new Error("Invalid source audit response");
    // Fail rather than accept a truncated response if a source ever reaches this cap.
    if (monthlyBorough.length >= 50000 || monthlyZip.length >= 50000)
      throw new Error(
        "Source audit requires pagination; refusing a possibly truncated result",
      );
    console.log(
      "Independent NYC source audit passed:",
      JSON.stringify(
        verifySourceAudit(snapshot, id, { totals, monthlyBorough, monthlyZip }),
      ),
    );
  }),
);

for (const preset of ["all", "12m", "ytd"]) {
  const [from, to] = presetRange(preset, snapshot.coverage);
  const summary = summarize(snapshot, from, to);
  const metrics = periodMetrics(summary, snapshot.coverage);
  console.log(
    JSON.stringify({
      preset,
      from,
      to,
      total: summary.total,
      completeMonthAverage: metrics.monthlyAverage,
      peakMonths: metrics.peakMonths,
      boroughs: summary.byBorough,
      topZips: summary.zips.slice(0, 5),
    }),
  );
}
