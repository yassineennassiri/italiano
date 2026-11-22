/**
 * Issue #40, SPEC §5.2.9: in A2.1.2, the `word_bank` step fills its gaps from
 * a bank of tiles. A tile goes into the first empty gap, a filled gap sends
 * its word back, Check marks each gap green or red, and a reload restores the
 * placed tiles and the checked looks. Everything is done with the keyboard
 * once the first tile has focus.
 *
 * Runs against the Neon `dev` branch only (the global setup checks), and
 * resets A2.1.2 first with the lesson menu's *Azzera*.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, resetLesson, shownText } from "./helpers";

const LESSON_2 = "/a2/la-casa-della-signora-pina";

const item = (page: Page) => page.locator(`section[data-item-id="a2.u01.l02.s09.i01"]`).filter({ visible: true });
const bank = (page: Page) => item(page).getByRole("group", { name: ui.lesson.wordBank });
/** The bank's tiles with this word, in the shown order. */
const tiles = (page: Page, word: string) => bank(page).getByRole("button", { name: word, exact: true });
const filledGap = (page: Page, number: number, word: string) => item(page).getByRole("button", { name: ui.lesson.filledGapLabel(number, word), exact: true });
/** An empty gap: a dashed box whose only text is its (screen-reader) label. */
const emptyGap = (page: Page, number: number) => item(page).locator(`span[data-gap="g${number}"]`, { hasText: ui.lesson.gapLabel(number) });
/** The bank holds these words, in this order. */
const expectBank = (page: Page, words: string[]) => expect(bank(page).getByRole("button")).toHaveText(words);

/** Presses Enter on the focused element and checks it was `locator`. */
async function enterOn(page: Page, locator: Locator) {
  await expect(locator).toBeFocused();
  await page.keyboard.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await resetLesson(page, LESSON_2);
});

test("tiles fill the first empty gap, a Check marks each gap, and a reload restores them", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/9`);
  await expect(shownText(page, ui.lesson.unbuiltItem)).toHaveCount(0);
  // Shuffled by the item id, with three "un", two "una" and the distractor "uno".
  await expectBank(page, ["un", "un'", "un", "una", "uno", "un", "una"]);
  for (let number = 1; number <= 6; number++) await expect(emptyGap(page, number)).toBeVisible();

  // una, un, un' (wrong), una, un (wrong), un: with the keyboard from the first tile.
  await hydrated(tiles(page, "una").first());
  await tiles(page, "una").first().focus();
  await page.keyboard.press("Enter");
  await expect(filledGap(page, 1, "una")).toBeVisible();
  for (const word of ["un", "un'", "una", "un", "un"]) {
    await tiles(page, word).first().focus();
    await page.keyboard.press("Enter");
  }
  await expectBank(page, ["uno"]);

  // A filled gap sends its word back, and a tile then fills that gap again.
  await filledGap(page, 2, "un").focus();
  await page.keyboard.press("Enter");
  await expect(emptyGap(page, 2)).toBeVisible();
  await enterOn(page, tiles(page, "un").first());
  await expect(filledGap(page, 2, "un")).toBeVisible();

  // The Check's server action, so the reload below finds it stored.
  const saved = page.waitForResponse((response) => response.request().headers()["next-action"] !== undefined);
  await item(page).getByRole("button", { name: ui.lesson.check }).click();
  await saved;
  await expect(page.getByRole("status")).toHaveText(ui.footer.sync.saved);
  await expectCounter(page, 1, 1, 0);
  await expect(filledGap(page, 1, "una")).toBeDisabled();
  await expect(filledGap(page, 3, "un'")).toHaveClass(/bg-bad/);
  await expect(filledGap(page, 5, "un")).toHaveClass(/bg-bad/);

  await page.reload();
  await hydrated(filledGap(page, 3, "un'"));
  await expectCounter(page, 1, 1, 0);
  await expect(filledGap(page, 1, "una")).toBeDisabled();
  await expect(filledGap(page, 1, "una")).toHaveClass(/bg-ok/);
  await expect(filledGap(page, 3, "un'")).toHaveClass(/bg-bad/);
  await expectBank(page, ["uno"]);

  // Fix the two red gaps: their words go back, then into gaps 3 and 5 in the right order.
  await filledGap(page, 3, "un'").focus();
  await page.keyboard.press("Enter");
  await enterOn(page, tiles(page, "un'"));
  await expect(filledGap(page, 3, "un'")).toBeVisible();
  await filledGap(page, 3, "un'").click();
  await filledGap(page, 5, "un").click();
  await tiles(page, "un").click();
  await tiles(page, "un'").click();
  await item(page).getByRole("button", { name: ui.lesson.check }).click();

  // Right on the second Check: every gap green and locked, still 0 points.
  for (const [number, word] of [[1, "una"], [3, "un"], [5, "un'"]] as const) {
    await expect(filledGap(page, number, word)).toHaveClass(/bg-ok/);
    await expect(filledGap(page, number, word)).toBeDisabled();
  }
  await expectCounter(page, 1, 1, 0);
  await expect(tiles(page, "uno")).toBeDisabled();
});
