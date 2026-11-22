/**
 * Issue #38, SPEC §5.2.6 and §5.2.7: in A2.1.2, the house rules render as a
 * document on a tinted panel above their questions, and the picture step
 * shows its reading as an intro paragraph above `image_choice` items, which
 * play like `single_choice`. Neither step keeps a placeholder card.
 *
 * Runs against the Neon `dev` branch only (the global setup checks), and
 * resets A2.1.2 first with the lesson menu's *Azzera*.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { hydrated, nextRefresh } from "./helpers";

const LESSON_2 = "/a2/la-casa-della-signora-pina";

const item = (page: Page, id: string) => page.locator(`section[data-item-id="a2.u01.l02.${id}"]`);
/** An option button by its text; once checked, its name also carries the ✓ / ✗ label. */
const option = (scope: Locator, text: string) =>
  scope.getByRole("button", { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`) });
// Next keeps the pages navigated away from in the DOM, hidden: lookups match only what is shown.
const shown = (locator: Locator) => locator.filter({ visible: true });
const expectCounter = (page: Page, completed: number, total: number, points: number) =>
  expect(shown(page.getByText(ui.lesson.footerCounter({ completed, total, points }), { exact: true }))).toBeVisible();

/** The top of an element on the page, to check what sits above what. */
const top = async (locator: Locator) => (await locator.boundingBox())!.y;

test.beforeEach(async ({ page }) => {
  await page.goto(`${LESSON_2}/info`);
  const menu = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("button", { name: ui.reset.lessonButton, exact: true }).click();
  const refreshed = nextRefresh(page);
  await page.getByRole("dialog").getByRole("button", { name: ui.reset.confirm, exact: true }).click();
  await refreshed;
});

test("a reading step shows its document on a tinted panel above its questions", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/7`);

  const reading = shown(page.locator("article").filter({ has: page.getByRole("heading", { name: "Le regole del palazzo", level: 2 }) }));
  await expect(reading).toBeVisible();
  await expect(reading.getByRole("heading", { name: "Per gli inquilini", level: 3 })).toBeVisible();
  await expect(reading.getByText(/^Benvenuti! Il palazzo è antico/)).toBeVisible();
  await expect(reading.getByRole("listitem")).toHaveCount(4);
  await expect(reading).toHaveClass(/bg-tint/);
  expect(await top(reading)).toBeLessThan(await top(item(page, "s07.i01")));

  // Its questions are single_choice items.
  const washer = item(page, "s07.i01");
  await hydrated(option(washer, "In cucina."));
  await option(washer, "In cucina.").click();
  await expectCounter(page, 1, 3, 1);
  await expect(shown(page.getByText(ui.lesson.unbuiltItem))).toHaveCount(0);
});

test("image_choice items play like single_choice under an intro paragraph", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/8`);

  const intro = shown(page.getByText(/^Nell'appartamento di Adam ci sono tante cose nuove/));
  await expect(intro).toBeVisible();
  await expect(page.locator("article.bg-tint").filter({ visible: true })).toHaveCount(0);
  expect(await top(intro)).toBeLessThan(await top(item(page, "s08.i01")));
  await expect(shown(page.getByText(ui.lesson.unbuiltItem))).toHaveCount(0);

  // The prompt bubble sits above the image.
  const mirror = item(page, "s08.i01");
  const image = mirror.getByRole("img", { name: ui.lesson.itemImageAlt });
  await expect(image).toBeVisible();
  expect(await top(mirror.getByText("Che cos'è?", { exact: true }))).toBeLessThan(await top(image));

  // Right at once: a point, and both options lock.
  await hydrated(option(mirror, "Uno specchio."));
  await option(mirror, "Uno specchio.").click();
  await expectCounter(page, 1, 3, 1);
  await expect(option(mirror, "Un armadio.")).toBeDisabled();

  // Wrong: the other option stays open, and the right retry scores nothing.
  const washer = item(page, "s08.i02");
  await option(washer, "Un frigorifero.").click();
  await expectCounter(page, 2, 3, 1);
  await expect(option(washer, "Una lavatrice.")).toBeEnabled();
  await option(washer, "Una lavatrice.").click();
  await expect(option(washer, "Una lavatrice.")).toBeDisabled();
  await expectCounter(page, 2, 3, 1);
});
