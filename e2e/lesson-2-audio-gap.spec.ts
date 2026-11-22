/**
 * Issue #41, SPEC §5.2.10: in A2.1.2, the `audio_gap` step shows a prompt
 * bubble and a mini clip player on the left, which speaks only its clip's
 * scene lines, and Adam's notes with typed gaps on the right. The gaps behave
 * like `text_gap`: the character helper inserts at the cursor, an accent-only
 * miss shows *Controlla l'accento*, and Enter checks the item.
 *
 * The browser gets a stand-in Italian `speechSynthesis` (`useStandInVoice`).
 * Runs against the Neon `dev` branch only (the global setup checks), and
 * resets A2.1.2 first with the lesson menu's *Azzera*.
 */
import { expect, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, resetLesson, shownText, spoken, useStandInVoice } from "./helpers";

const LESSON_2 = "/a2/la-casa-della-signora-pina";
const STEP = `${LESSON_2}/esercizi/6`;

const item = (page: Page) => page.locator(`section[data-item-id="a2.u01.l02.s06.i01"]`).filter({ visible: true });
const gap = (page: Page, number: number) => item(page).getByLabel(ui.lesson.gapLabel(number), { exact: true });
const accentHint = (page: Page) => item(page).getByText(ui.lesson.accentHint, { exact: true });

/** Fills the gaps in order: gap 1 gets the first word, and so on. */
async function fillGaps(page: Page, words: readonly string[]) {
  for (const [index, word] of words.entries()) await gap(page, index + 1).fill(word);
}

test.beforeEach(async ({ page }) => {
  await useStandInVoice(page);
  await resetLesson(page, LESSON_2);
});

test("the mini player speaks only the clip's lines, and a right first Check scores a point", async ({ page }) => {
  await page.goto(STEP);
  await expect(shownText(page, ui.lesson.unbuiltItem)).toHaveCount(0);
  await expect(item(page).getByText("Adam prende appunti sull'appartamento.", { exact: true })).toBeVisible();

  // The mini player sits in the item, left of the notes: L6 to L8 of the scene.
  const player = item(page).getByRole("group", { name: ui.lesson.clipPlayer.label });
  await expect(player.getByText(ui.lesson.player.lineOf(1, 3), { exact: true })).toBeVisible();
  expect((await player.boundingBox())!.x).toBeLessThan((await gap(page, 1).boundingBox())!.x);
  const play = player.getByRole("button", { name: ui.lesson.listen, exact: true });
  await hydrated(play);
  await play.click();
  await expect.poll(() => spoken(page)).toEqual([
    "Allora: questa è la cucina, con un frigorifero e una lavatrice.",
    "E c'è anche un bagno?",
    "Certo: un bagno piccolo, con una doccia. E qui c'è una camera da letto con un armadio.",
  ]);
  await expect(player.getByText(ui.lesson.player.lineOf(3, 3), { exact: true })).toBeVisible();
  await expect(play).toBeVisible();
  expect(await spoken(page)).toHaveLength(3);

  // Enter in a gap checks the item: all right at once is a point, and everything locks.
  await fillGaps(page, ["un", "una", "un", "una", "un"]);
  await gap(page, 5).press("Enter");
  await expectCounter(page, 1, 1, 1);
  for (let number = 1; number <= 5; number++) {
    await expect(gap(page, number)).toBeDisabled();
    await expect(gap(page, number)).toHaveClass(/bg-ok/);
  }
  await expect(item(page).getByRole("button", { name: ui.lesson.check })).toBeDisabled();
});

test("the character helper inserts at the cursor, an accent-only miss gets the hint, and a reload keeps it", async ({ page }) => {
  await page.goto(STEP);
  await fillGaps(page, ["un", "na", "un", "una", "un"]);

  // "na" with the cursor at its start, then ù from the helper: "ùna", wrong only by an accent.
  const second = gap(page, 2);
  await hydrated(second);
  await second.focus();
  await second.press("Home");
  await item(page).getByRole("button", { name: ui.lesson.characterHelper, exact: true }).click();
  await item(page).getByRole("button", { name: ui.lesson.insertCharacter("ù"), exact: true }).click();
  await expect(second).toHaveValue("ùna");
  await expect(second).toBeFocused();

  // The Check's server action, so the reload below finds it stored.
  const saved = page.waitForResponse((response) => response.request().headers()["next-action"] !== undefined);
  await second.press("Enter");
  await saved;
  await expect(page.getByRole("status")).toHaveText(ui.footer.sync.saved);
  await expectCounter(page, 1, 1, 0);
  await expect(second).toHaveClass(/bg-bad/);
  await expect(second).toBeEnabled();
  await expect(accentHint(page)).toBeVisible();
  await expect(gap(page, 1)).toBeDisabled();

  await page.reload();
  await hydrated(gap(page, 2));
  await expectCounter(page, 1, 1, 0);
  await expect(gap(page, 2)).toHaveValue("ùna");
  await expect(accentHint(page)).toBeVisible();

  // Fixed on the second Check: all green and locked, still 0 points.
  await gap(page, 2).fill("una");
  await expect(accentHint(page)).toHaveCount(0);
  await gap(page, 2).press("Enter");
  await expect(gap(page, 2)).toHaveClass(/bg-ok/);
  await expect(gap(page, 2)).toBeDisabled();
  await expectCounter(page, 1, 1, 0);
});
