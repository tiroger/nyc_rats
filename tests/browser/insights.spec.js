import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { presetRange, number, monthLabel } from "../../src/lib/data.mjs";
import {
  summarizeBurrows,
  summarizeInspections,
  summarizeHabitats,
} from "../../src/lib/details.mjs";

const sightings = JSON.parse(
  await readFile(
    new URL("../../public/data/sightings.json", import.meta.url),
    "utf8",
  ),
);
const details = JSON.parse(
  await readFile(
    new URL("../../public/data/details.json", import.meta.url),
    "utf8",
  ),
);
const [start, end] = presetRange("12m", sightings.coverage);

test("habitat categories and repeat-property metrics follow the selected dates and borough", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByTestId("habitats-panel")).toBeVisible();
  const habitat = summarizeHabitats(details, start, end);
  const streets = habitat.groups.find((g) => g.id === "streets");
  await page
    .getByRole("group", { name: "Reported habitats" })
    .getByRole("button", { name: /Streets & sidewalks/ })
    .click();
  await expect(page.locator(".habitat-selected")).toContainText(
    number.format(streets.count),
  );
  await page.getByRole("tab", { name: "Repeat burrows" }).click();
  await expect(page.getByTestId("distinct-lots")).toHaveText(
    number.format(summarizeBurrows(details, start, end).propertyCount),
  );
  await page.getByLabel("Map layer").selectOption("properties");
  await expect(page.getByTestId("map-period")).toContainText("ALL NYC /");
  await expect(page.locator(".map-source-note")).toContainText(
    "each assigned once",
  );
  await expect(page.locator(".map-legend")).toContainText("distinct tax lots");
  await page
    .getByRole("group", { name: "Filter by borough" })
    .getByRole("button", { name: "Brooklyn", exact: true })
    .click();
  const expected = summarizeBurrows(details, start, end, "Brooklyn");
  await expect(page.getByTestId("distinct-lots")).toHaveText(
    number.format(expected.propertyCount),
  );
  await page
    .getByRole("button", {
      name: new RegExp(`Tax lot ${expected.properties[1].bbl},`),
    })
    .click();
  await expect(page.locator(".burrow-selection")).toContainText(
    expected.properties[1].bbl,
  );
  await expect(page.locator(".burrow-selection > strong")).toContainText(
    number.format(expected.properties[1].count),
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("inspection stages use separate denominators and findings can be shown on the map", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByTestId("habitats-panel")).toBeVisible();
  await page.getByRole("tab", { name: "Inspection findings" }).click();
  const initial = summarizeInspections(details, start, end);
  await expect(page.getByTestId("inspection-total")).toHaveText(
    number.format(initial.total),
  );
  await expect(page.getByTestId("inspection-positive")).toHaveText(
    number.format(initial.positive),
  );
  await page
    .getByRole("group", { name: "Inspection stage", exact: true })
    .getByRole("button", { name: "Compliance", exact: true })
    .click();
  const compliance = summarizeInspections(
    details,
    start,
    end,
    "All NYC",
    "Compliance",
  );
  await expect(page.getByTestId("inspection-total")).toHaveText(
    number.format(compliance.total),
  );
  await expect(page.getByTestId("inspection-positive")).toHaveText(
    number.format(compliance.positive),
  );
  await page.getByRole("button", { name: "Show findings on the map" }).click();
  await expect(page.getByLabel("Map layer")).toHaveValue("inspections");
  await expect(page.getByLabel("Map inspection stage")).toHaveValue(
    "Compliance",
  );
  await expect(page.locator(".map-legend")).toContainText(
    "rat-positive inspection records",
  );
  await expect(page).toHaveURL(/layer=inspections&stage=compliance/);
  await page.reload();
  await expect(page.getByLabel("Map layer")).toHaveValue("inspections");
  await expect(page.getByLabel("Map inspection stage")).toHaveValue(
    "Compliance",
  );
  await expect(
    page.getByRole("tab", { name: "Inspection findings" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Time period").selectOption("all");
  const coverage = details.inspections.coverage;
  await expect(page.getByTestId("map-period")).toContainText(
    `ALL NYC / ${monthLabel(coverage.from.slice(0, 7), true).toUpperCase()} — ${monthLabel(coverage.to.slice(0, 7), true).toUpperCase()}`,
  );
  await expect(page.getByTestId("map-period")).toContainText(
    new Date(`${coverage.to}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  );
  await expect(page.locator(".selection-caption")).toContainText("JAN 2010");
});

test("unsupported historical dates show missing coverage and additional-data failures preserve the atlas", async ({
  page,
}) => {
  await page.goto("./?from=2010-01&to=2019-12");
  await expect(
    page.getByRole("heading", { name: "This view begins in 2020." }),
  ).toBeVisible();
  await page.getByLabel("Map layer").selectOption("properties");
  await expect(page.getByTestId("map-period")).toContainText(
    "NO AVAILABLE COVERAGE",
  );
  await page
    .getByRole("button", { name: "Explore available detail dates" })
    .click();
  await expect(page.getByTestId("habitats-panel")).toBeVisible();
  await expect(page).toHaveURL(/from=2020-01/);
  await page.route("**/data/details.json*", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The extra data couldn’t load." }),
  ).toBeVisible();
  await expect(page.getByTestId("total-reports")).not.toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Retry additional data" }),
  ).toBeVisible();
});

test("hotspot playback uses complete years, supports scrubbing, and respects reduced motion", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("total-reports").waitFor();
  const play = page.getByRole("button", { name: "Play hotspot animation" });
  await play.click();
  await expect(
    page.getByRole("button", { name: "Pause hotspot animation" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-legend")).toContainText("fixed year scale");
  await expect(
    page.getByTestId("map-period").locator("span").first(),
  ).toHaveText(
    await page.locator(".selection-caption > span").first().innerText(),
  );
  await page.getByRole("button", { name: "Pause hotspot animation" }).click();
  const slider = page.getByRole("slider", {
    name: "Hotspot year",
    exact: true,
  });
  await slider.press("End");
  for (let y = Number(await slider.getAttribute("max")); y > 2022; y--)
    await slider.press("ArrowLeft");
  await expect(page).toHaveURL(/from=2022-01&to=2022-12/);
  await expect(page.locator(".player-title")).toContainText(
    "2022 / resident reports",
  );
  await page.getByRole("button", { name: "Next hotspot year" }).click();
  await expect(page).toHaveURL(/from=2023-01&to=2023-12/);
  await page.reload();
  await expect(page.locator(".map-legend")).toContainText("fixed year scale");
  await expect(page.locator(".player-title")).toContainText(
    "2023 / resident reports",
  );
  await expect(page.getByLabel("Time period")).toHaveValue("2023");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Play hotspot animation" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Reduced motion is on.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to latest 12 months" }).click();
  await expect(page.getByLabel("Time period")).toHaveValue("12m");
});

test("repeat-property and inspection views remain accessible", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("habitats-panel").waitFor();
  for (const tab of ["Repeat burrows", "Inspection findings"]) {
    await page.getByRole("tab", { name: tab }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
