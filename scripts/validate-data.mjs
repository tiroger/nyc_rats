import { readFile } from "node:fs/promises";
import { validateSnapshot } from "../src/lib/data.mjs";
import { validateDetails } from "../src/lib/details.mjs";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/sightings.json", import.meta.url),
    "utf8",
  ),
);
console.log(
  `Validated ${validateSnapshot(data).toLocaleString()} reports across ${data.rows.length.toLocaleString()} monthly ZIP aggregates.`,
);
const details = JSON.parse(
  await readFile(
    new URL("../public/data/details.json", import.meta.url),
    "utf8",
  ),
);
console.log("Validated expanded data:", validateDetails(details, data));
for (const file of ["boroughs.geojson", "zip-codes.geojson"]) {
  const geo = JSON.parse(
    await readFile(new URL(`../public/geo/${file}`, import.meta.url), "utf8"),
  );
  if (geo.type !== "FeatureCollection" || !geo.features.length)
    throw new Error(`Invalid geography: ${file}`);
}
