import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Night shift turns the whole atlas after dark, persists, and turns back", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("total-reports").waitFor();
  const toggle = page.getByRole("button", { name: "Night shift", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.getByRole("list", { name: "Collected stamps" })).toContainText(
    "Night-shift regular: collected",
  );
  await expect(page.locator(".street-layer")).toBeAttached();
  await expect(page.getByRole("region", { name: "Night shift controls" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The late-night buffet." })).toBeAttached();
  // The map's compass is a shortcut to the same switch.
  await expect(page.getByRole("button", { name: "Night-shift map" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("button", { name: "Lights on" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(page.locator(".street-layer")).toHaveCount(0);
  await expect(page.locator("#curbside")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
});

test("the curbside playground responds to its controls", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Night shift", exact: true }).click();
  const status = page.getByTestId("curbside-status");
  await status.scrollIntoViewIfNeeded();
  await expect(status).toContainText("pieces of trash on the curb");
  await page.getByRole("button", { name: "Put out a bag" }).click();
  await page.getByRole("button", { name: "Kick the pile" }).click();
  await page.getByRole("button", { name: "Call a night pickup" }).click();
  await expect(status).toContainText("Pickups so far", { timeout: 10_000 });
  const bins = page.getByRole("button", { name: "Use sealed bins" });
  await bins.click();
  await expect(page.getByRole("button", { name: "Back to bags on the curb" })).toHaveAttribute("aria-pressed", "true");
  await expect(status).toContainText("Bins sealed");
});

test("Night shift stays readable and accessible, and stills with reduced motion", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Night shift", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss discovery" }).click();
  await page.getByTestId("curbside-status").waitFor();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".street-layer")).toHaveAttribute("data-paused", "");
  await expect(page.getByText("Motion is off, so the curb is frozen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Call a night pickup" })).toBeDisabled();
});
