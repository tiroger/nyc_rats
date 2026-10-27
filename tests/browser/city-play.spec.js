import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  number,
  monthLabel,
  monthOffset,
  summarize,
  periodMetrics,
  presetRange,
} from "../../src/lib/data.mjs";
import {
  summarizeHabitats,
  summarizeBurrows,
  summarizeInspections,
  detailRange,
} from "../../src/lib/details.mjs";

const snapshot = JSON.parse(
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

test("NYC secrets work with the keyboard, persist, and remain accessible", async ({
  page,
  isMobile,
}) => {
  await page.goto("./");
  const pizza = page.getByRole("button", { name: /Psst. Got pizza/ });
  await pizza.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("list", { name: "Collected stamps" }),
  ).toContainText("Pizza patron: collected");
  await page.getByRole("button", { name: "Dismiss discovery" }).click();
  const route = page.getByRole("navigation", { name: "Rat Local page stops" });
  await route.getByRole("link", { name: "Local stop" }).click();
  await expect(page).toHaveURL(/#city-corner$/);
  await expect(route.getByRole("link", { name: "Local stop" })).toHaveAttribute(
    "aria-current",
    "location",
  );
  const cover = page.getByRole("button", { name: /Lift the manhole/ });
  await cover.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: /Close the manhole/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("SEWER SOCIAL CLUB")).toBeVisible();
  const compass = page.getByRole("button", { name: "Night-shift map" });
  await compass.click();
  await expect(compass).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("list", { name: "Collected stamps" }),
  ).toContainText("Night-shift regular: collected");
  if (isMobile) {
    await page.getByText("Need a clue?", { exact: true }).click();
    await page.getByRole("button", { name: /Call the secret express/ }).click();
  } else {
    await page.keyboard.type("rat");
  }
  await expect(
    page.getByRole("heading", { name: "Honorary Rat Local rider." }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Dismiss discovery" }).click();
  const skip = page.getByRole("link", { name: "Skip to the atlas" });
  await skip.focus();
  await skip.click();
  await expect(page).toHaveURL(/#explore$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Honorary Rat Local rider." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Lift the manhole/ }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("fact tickets match source aggregates and remain explicitly citywide", async ({
  page,
}) => {
  await page.goto("./");
  // Wait for optional detail data so the ticket deck is stable.
  await expect(page.getByTestId("habitats-panel")).toBeVisible();
  const ticket = page.getByRole("article", { name: "Citywide fact ticket" });
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(snapshot.totalReports),
  );
  await page
    .getByRole("group", { name: "Filter by borough" })
    .getByRole("button", { name: "Brooklyn", exact: true })
    .click();
  await expect(ticket).toContainText("CITYWIDE · ALL BOROUGHS");
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(snapshot.totalReports),
  );
  const next = ticket.getByRole("button", { name: "Another city fact" });
  await next.click();
  const history = periodMetrics(
    summarize(snapshot, ...presetRange("all", snapshot.coverage)),
    snapshot.coverage,
  );
  await expect(ticket).toContainText(monthLabel(history.peakMonths[0].month));
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(history.peakCount),
  );
  const end = monthOffset(snapshot.coverage.to.slice(0, 7), -1),
    start = monthOffset(end, -11);
  const habitats = summarizeHabitats(details, start, end);
  const top = habitats.groups.toSorted((a, b) => b.count - a.count)[0];
  await next.click();
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    `${Math.round((top.count / habitats.total) * 100)}%`,
  );
  await expect(ticket).toContainText(
    `${monthLabel(start, true)} → ${monthLabel(end, true)}`,
  );
  await next.click();
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(summarizeBurrows(details, start, end).repeatProperties),
  );
  await next.click();
  const range = detailRange(details.inspections.coverage, start, end);
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(summarizeInspections(details, ...range).positive),
  );
  await expect(ticket).toContainText("not a citywide prevalence survey");
  await next.click();
  await expect(ticket.locator(".ticket-fact > strong")).toHaveText(
    number.format(snapshot.totalReports),
  );
});

test("motion controls stop playback, persist, and follow system preferences", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Play hotspot animation" }).click();
  await expect(
    page.getByRole("button", { name: "Pause hotspot animation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Motion on" }).click();
  await expect(
    page.getByRole("button", { name: "Play hotspot animation" }),
  ).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Motion off" }),
  ).toHaveAttribute("aria-pressed", "false");
  const year = Number(
    await page.getByRole("slider", { name: "Hotspot year" }).inputValue(),
  );
  await page.getByRole("button", { name: "Next hotspot year" }).click();
  await expect(page).toHaveURL(new RegExp(`frame=${year + 1}`));
  await page.getByRole("button", { name: "Motion off" }).click();
  await expect(
    page.getByRole("button", { name: "Play hotspot animation" }),
  ).toBeEnabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: /Motion off/ })).toBeDisabled();
  await expect(page.getByText(/Reduced motion is on/)).toBeVisible();
  // Form controls must not trigger the secret key sequence.
  await page.getByLabel("Time period").focus();
  await page.keyboard.type("rat");
  await expect(
    page.getByRole("list", { name: "Collected stamps" }),
  ).toContainText("Secret express: undiscovered");
});

test("the Rat Gazette cycles Wikipedia lore with pinned, section-level sources", async ({ page }) => {
  await page.goto("./");
  const gazette = page.getByRole("article", { name: "Rat lore from Wikipedia" });
  await gazette.scrollIntoViewIfNeeded();
  const headline = gazette.locator("h3");
  const first = await headline.innerText();
  await expect(gazette.getByRole("link", { name: /From Wikipedia/ })).toHaveAttribute("href", /oldid=\d+#Species$/);
  await gazette.getByRole("button", { name: "Next clipping ↻" }).click();
  await expect(headline).not.toHaveText(first);
  await expect(gazette.getByRole("link", { name: /From Wikipedia/ })).toHaveAttribute("href", /oldid=\d+#Genetics$/);
  await expect(gazette).toContainText("CC BY-SA 4.0");
});

test("the species sheet explains each hotspot with a pinned source", async ({ page }) => {
  await page.goto("./");
  const sheet = page.locator("#species");
  await sheet.scrollIntoViewIfNeeded();
  await expect(sheet.getByRole("heading", { name: "Rattus norvegicus" })).toBeVisible();
  const ear = sheet.getByRole("button", { name: "3. Ear" });
  await ear.click();
  await expect(ear).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.locator(".anatomy-note h4")).toHaveText("They laugh in ultrasound.");
  await expect(sheet.locator(".anatomy-note a")).toHaveAttribute("href", /oldid=\d+#Communication$/);
  await expect(sheet).toContainText("OUR DATA");
  await expect(sheet.getByRole("list", { name: "Origin timeline of the brown rat" }).getByRole("listitem")).toHaveCount(8);
  await expect(sheet).toContainText("doi:10.1093/af/vfab020");
});
