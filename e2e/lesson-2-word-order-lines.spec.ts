/**
 * Issue #42, SPEC §5.2.3 and §5.2.13: in A2.1.2, step 10's `word_order` item
 * uses the lines layout. Its tiles are whole script lines, stacked full width
 * in both the tray and the answer box. Placing, returning, Check and a reload
 * work as in the words layout, with clicks and with the keyboard, and the
 * shuffle is the same after a reload.
 *
 * Runs against the Neon `dev` branch only (the global setup checks), and
 * resets A2.1.2 first with the lesson menu's *Azzera*.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, resetLesson, shownText } from "./helpers";

const LESSON_2 = "/a2/la-casa-della-signora-pina";

const KEY_LINE = "Pina: Ecco la chiave. Attenzione, la porta è un po' dura.";
const KITCHEN_LINE = "Pina: Allora: questa è la cucina, con un frigorifero e una lavatrice.";
const BATHROOM_LINE = "Adam: E c'è anche un bagno?";
const BEDROOM_LINE = "Pina: Certo: un bagno piccolo, con una doccia. E qui c'è una camera da letto con un armadio.";

const item = (page: Page) => page.locator(`section[data-item-id="a2.u01.l02.s10.i01"]`).filter({ visible: true });
const box = (page: Page) => item(page).getByRole("group", { name: ui.lesson.answerBox });
const tray = (page: Page) => item(page).getByRole("group", { name: ui.lesson.lineTray });
const line = (group: Locator, text: string) => group.getByRole("button", { name: text, exact: true });

/** The group holds these lines, in this order, each as wide as the group and below the one before. */
async function expectStackedLines(group: Locator, texts: string[]) {
  const tiles = group.getByRole("button");
  await expect(tiles).toHaveText(texts);
  const area = (await group.boundingBox())!;
  let bottom = -Infinity;
  for (const tile of await tiles.all()) {
    const shape = (await tile.boundingBox())!;
    // Full width: only the group's padding and the feedback icon are left beside a line.
    expect(shape.width).toBeGreaterThan(area.width * 0.85);
    expect(shape.y).toBeGreaterThanOrEqual(bottom);
    bottom = shape.y + shape.height;
  }
}

test.beforeEach(async ({ page }) => {
  await resetLesson(page, LESSON_2);
});

test("script lines stack full width, place and return, and a Check survives a reload", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/10`);
  await expect(shownText(page, ui.lesson.unbuiltItem)).toHaveCount(0);
  // Shuffled by the item id, never in the order of the scene.
  const shuffled = [BATHROOM_LINE, KITCHEN_LINE, BEDROOM_LINE, KEY_LINE];
  await expectStackedLines(tray(page), shuffled);
  await page.reload();
  await expectStackedLines(tray(page), shuffled);

  // With the keyboard: place key and bathroom, then send the bathroom back.
  await hydrated(line(tray(page), KEY_LINE));
  await line(tray(page), KEY_LINE).focus();
  await page.keyboard.press("Enter");
  await expect(line(box(page), KEY_LINE)).toBeVisible();
  await line(tray(page), BATHROOM_LINE).focus();
  await page.keyboard.press("Enter");
  await line(box(page), BATHROOM_LINE).focus();
  await page.keyboard.press("Enter");
  await expect(line(tray(page), BATHROOM_LINE)).toBeVisible();
  // Focus goes to the line now in its place, the key line left in the box.
  await expect(line(box(page), KEY_LINE)).toBeFocused();
  // Then with clicks: kitchen, bedroom and bathroom (wrong).
  await line(tray(page), KITCHEN_LINE).click();
  await expectStackedLines(tray(page), [BATHROOM_LINE, BEDROOM_LINE]);
  for (const text of [BEDROOM_LINE, BATHROOM_LINE]) await line(tray(page), text).click();
  await expectStackedLines(box(page), [KEY_LINE, KITCHEN_LINE, BEDROOM_LINE, BATHROOM_LINE]);
  await expect(tray(page).getByRole("button")).toHaveCount(0);

  // The Check's server action, so the reload below finds it stored.
  const saved = page.waitForResponse((response) => response.request().headers()["next-action"] !== undefined);
  await item(page).getByRole("button", { name: ui.lesson.check }).click();
  await saved;
  await expect(page.getByRole("status")).toHaveText(ui.footer.sync.saved);
  await expect(box(page)).toHaveAttribute("data-look", "wrong");
  await expectCounter(page, 1, 1, 0);

  await page.reload();
  await hydrated(line(box(page), BATHROOM_LINE));
  await expect(box(page)).toHaveAttribute("data-look", "wrong");
  await expectStackedLines(box(page), [KEY_LINE, KITCHEN_LINE, BEDROOM_LINE, BATHROOM_LINE]);
  await expectCounter(page, 1, 1, 0);

  // Fix the last two lines: right on the second Check, green and locked, still 0 points.
  await line(box(page), BEDROOM_LINE).click();
  await expect(box(page)).toHaveAttribute("data-look", "idle");
  await line(box(page), BATHROOM_LINE).click();
  for (const text of [BATHROOM_LINE, BEDROOM_LINE]) await line(tray(page), text).click();
  await item(page).getByRole("button", { name: ui.lesson.check }).click();
  await expect(box(page)).toHaveAttribute("data-look", "correct");
  await expectStackedLines(box(page), [KEY_LINE, KITCHEN_LINE, BATHROOM_LINE, BEDROOM_LINE]);
  await expect(line(box(page), KEY_LINE)).toBeDisabled();
  await expectCounter(page, 1, 1, 0);
});
