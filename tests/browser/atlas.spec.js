import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  summarize,
  periodMetrics,
  presetRange,
  monthLabel,
  number,
} from "../../src/lib/data.mjs";

const snapshot = JSON.parse(
  await readFile(
    new URL("../../public/data/sightings.json", import.meta.url),
    "utf8",
  ),
);
const geography = JSON.parse(
  await readFile(
    new URL("../../public/geo/zip-codes.geojson", import.meta.url),
    "utf8",
  ),
);
const knownZips = new Set(
  geography.features
    .filter(
      (f) =>
        Number.isFinite(Number(f.properties.longitude)) &&
        Number.isFinite(Number(f.properties.latitude)),
    )
    .map((f) => f.properties.postalCode),
);

test("atlas loads without runtime errors, filters reports, and survives a shared-link reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "New York,from the ground up.",
  );
  const total = page.getByTestId("total-reports");
  await expect(total).not.toHaveText("0");
  const citywide = Number((await total.innerText()).replaceAll(",", ""));
  await page
    .getByRole("group", { name: "Filter by borough" })
    .getByRole("button", { name: "Brooklyn", exact: true })
    .click();
  await expect(page).toHaveURL(/borough=Brooklyn/);
  const filtered = Number((await total.innerText()).replaceAll(",", ""));
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(citywide);
  await page.getByLabel("Time period").selectOption("2019");
  await expect(page).toHaveURL(/from=2019-01/);
  const expected = await total.innerText();
  await page.reload();
  await expect(total).toHaveText(expected);
  await expect(page.getByLabel("Time period")).toHaveValue("2019");
  await expect(
    page
      .getByRole("group", { name: "Filter by borough" })
      .getByRole("button", { name: "Brooklyn", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the default period survives reload and old date links recover their preset labels", async ({
  page,
}) => {
  const period = page.getByLabel("Time period");
  const [from, to] = presetRange("12m", snapshot.coverage);
  await page.goto("./");
  await expect(period).toHaveValue("12m");
  await expect(page).toHaveURL(/period=12m/);
  await page.reload();
  await expect(period).toHaveValue("12m");
  for (const preset of ["ytd", "all"]) {
    await period.selectOption(preset);
    await page.reload();
    await expect(period).toHaveValue(preset);
  }
  await page.goto(`./?from=${from}&to=${to}`);
  await expect(period).toHaveValue("12m");
  await page.goto("./?from=2020-03&to=2020-05");
  await expect(period).toHaveValue("custom");
  await page.reload();
  await expect(period).toHaveValue("custom");
});

test("strip totals, map dates, ZIP counts, and unmatched counts reconcile across periods and boroughs", async ({
  page,
}) => {
  await page.goto("./");
  for (const [preset, borough, b] of [
    ["12m", "All NYC", null],
    ["2019", "Brooklyn", 1],
    ["all", "All NYC", null],
  ]) {
    await page.getByLabel("Time period").selectOption(preset);
    await page
      .getByRole("group", { name: "Filter by borough" })
      .getByRole("button", { name: borough, exact: true })
      .click();
    const [from, to] = presetRange(preset, snapshot.coverage);
    // Sum raw snapshot rows independently of the UI aggregation helper.
    const rows = snapshot.rows.filter(
      (row) => row[0] >= from && row[0] <= to && (b === null || row[1] === b),
    );
    const total = rows.reduce((n, row) => n + row[3], 0);
    const zips = new Map();
    for (const [, , zip, count] of rows)
      if (knownZips.has(zip)) zips.set(zip, (zips.get(zip) || 0) + count);
    const mapped = [...zips.values()].reduce((a, b) => a + b, 0);
    await expect(page.getByTestId("total-reports")).toHaveText(
      number.format(total),
    );
    await expect(
      page.getByTestId("map-period").locator("span").first(),
    ).toHaveText(
      await page.locator(".selection-caption > span").first().innerText(),
    );
    await expect(page.getByTestId("map-counts")).toHaveText(
      `${number.format(mapped)} reports mapped · ${number.format(total - mapped)} without a matching ZIP`,
    );
    const bubbles = await page.locator(".report-bubble").evaluateAll((nodes) =>
      nodes.map((node) => {
        const [, zip, count] = node
          .getAttribute("aria-label")
          .match(/^ZIP (\d{5}), ([\d,]+) reports$/);
        return [zip, Number(count.replaceAll(",", ""))];
      }),
    );
    expect(Object.fromEntries(bubbles)).toEqual(Object.fromEntries(zips));
  }
  await page.getByRole("button", { name: "Next hotspot year" }).click();
  const year = Number(
    await page.getByRole("slider", { name: "Hotspot year" }).inputValue(),
  );
  await expect(page.getByLabel("Time period")).toHaveValue(String(year));
  await expect(page.getByTestId("map-period")).toContainText(
    `JAN ${year} — DEC ${year}`,
  );
  await expect(page.getByTestId("total-reports")).toHaveText(
    number.format(
      snapshot.rows
        .filter((row) => row[0].startsWith(String(year)))
        .reduce((n, row) => n + row[3], 0),
    ),
  );
});

test("map controls, ZIP selection, seasonality, and CSV export work together", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("heading", { name: "A city of tiny footprints." })
    .waitFor();
  await page.getByRole("button", { name: "ZIP areas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ZIP areas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset map zoom", exact: true })
    .click();
  await page.locator(".zip-ranking button").first().click();
  await expect(
    page.getByRole("status", { name: "Selected ZIP details" }),
  ).toContainText("reported sightings");
  await page.getByRole("button", { name: "Close ZIP details" }).click();
  await page
    .getByRole("button", { name: /January 2020, .* reports. Explore month./ })
    .click();
  await expect(page.getByLabel("Time period")).toHaveValue("custom");
  await expect(page).toHaveURL(/from=2020-01&to=2020-01/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download monthly data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "ratlas-all-nyc-2020-01-2020-01.csv",
  );
  await page.getByText("View monthly data table").click();
  await expect(page.getByRole("table")).toContainText("January 2020");
});

test("data load failure offers recovery instead of a blank page", async ({
  page,
}) => {
  await page.route("**/data/sightings.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "A little snag underground." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("atlas has no serious accessibility violations", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("total-reports").waitFor();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("peak labels distinguish the selected period from the historical record and average only complete months", async ({
  page,
}) => {
  const recent = summarize(snapshot, ...presetRange("12m", snapshot.coverage));
  const recentMetrics = periodMetrics(recent, snapshot.coverage);
  const history = periodMetrics(
    summarize(snapshot, ...presetRange("all", snapshot.coverage)),
    snapshot.coverage,
  );
  await page.goto("./");
  await expect(page.getByTestId("total-reports")).toHaveText(
    number.format(recent.total),
  );
  await expect(page.getByTestId("peak-month")).toContainText(
    monthLabel(recentMetrics.peakMonths[0].month, true),
  );
  await expect(page.getByTestId("monthly-average")).toContainText(
    number.format(Math.round(recentMetrics.monthlyAverage)),
  );
  await expect(
    page.getByText("BUSIEST MONTH IN THIS PERIOD", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("historical-peak")).toContainText(
    monthLabel(history.peakMonths[0].month),
  );
  await expect(page.getByTestId("historical-peak")).toContainText(
    number.format(history.peakCount),
  );
  await page.getByLabel("Time period").selectOption("all");
  await expect(page.getByTestId("peak-month")).toContainText(
    monthLabel(history.peakMonths[0].month, true),
  );
  await page.getByRole("button", { name: "Explore record month" }).click();
  await expect(page.getByTestId("total-reports")).toHaveText(
    number.format(history.peakCount),
  );
  await expect(page).toHaveURL(
    new RegExp(
      `from=${history.peakMonths[0].month}&to=${history.peakMonths[0].month}`,
    ),
  );
  const current = snapshot.coverage.to.slice(0, 7);
  await page.goto(`./?from=${current}&to=${current}`);
  await expect(page.getByTestId("monthly-average")).toContainText("—");
  await expect(
    page.getByText("No complete months in this selection"),
  ).toBeVisible();
});
