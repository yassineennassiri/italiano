/**
 * The M1 happy path (issue #18): A2.1.1 from the level overview to the Finish
 * screen with a known mix of right and wrong answers, then the overview and a
 * step after a reload. Runs against the Neon `dev` branch only (the global
 * setup checks), and resets its own data first with the level's *Azzera*.
 * UI text comes from `ui-it.ts`, like the app's.
 *
 * The planned answers, 7 scorable items (ADR-0002):
 *   s01  i01 right · i02 wrong · i03 right        2 points
 *   s02  dropdown right                           1
 *   s03  text_gap with one wrong gap              0
 *   s04  i01 right · i02 untouched                1
 *   s05  three exchanges rated Bene               self-rated, no points
 *   s06  Parla! rated Bene                        self-rated, no points
 * → 4 / 7 = 57%, and 5 of 6 steps complete (s04 is not).
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";

const LESSON = "/a2/benvenuto-a-genova";

/** Waits until React has hydrated the element, so a click isn't lost on a freshly loaded page. */
async function hydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber"))))
    .toBe(true);
}

const item = (page: Page, id: string) => page.locator(`section[data-item-id="a2.u01.l01.${id}"]`);
const option = (scope: Locator, name: string) => scope.getByRole("button", { name, exact: true });
// Next keeps the pages navigated away from in the DOM, hidden: text lookups match only what is shown.
const shownText = (page: Page, text: string | RegExp) => page.getByText(text, { exact: typeof text === "string" }).filter({ visible: true });
/** The step footer's counter shows `completed` of `total` exercises and `points` (SPEC §6.2). */
const expectCounter = (page: Page, completed: number, total: number, points: number) =>
  expect(shownText(page, ui.lesson.footerCounter({ completed, total, points }))).toBeVisible();

/** The lesson card's status circle says exactly this, e.g. *Completata · 57%*. */
const expectCardStatus = (card: Locator, status: string) => expect(card.getByText(status, { exact: true })).toHaveCount(1);

async function next(page: Page, path: string): Promise<void> {
  await page.getByRole("link", { name: ui.lesson.next, exact: true }).click();
  await expect(page).toHaveURL(`${LESSON}/${path}`);
}

test("plays A2.1.1 to the Finish screen and the overview shows it completed with the same %", async ({ page }) => {
  // Reset our own data: Azzera for the whole level.
  await page.goto("/a2");
  const card = page.getByRole("link", { name: /Benvenuto a Genova!/ });
  const azzera = page.getByRole("button", { name: ui.reset.levelButton, exact: true });
  await hydrated(azzera);
  await azzera.click();
  await page.getByRole("dialog").getByRole("button", { name: ui.reset.confirm, exact: true }).click();
  await expectCardStatus(card, ui.lessonStatus("not_started"));

  // The intro, then step 1.
  await card.click();
  await expect(page).toHaveURL(`${LESSON}/info`);
  await page.getByRole("link", { name: ui.lesson.start }).click();
  await expect(page).toHaveURL(`${LESSON}/esercizi/1`);

  // Step 1: a right and a wrong single choice, then the three right options of the multi-select.
  await option(item(page, "s01.i01"), "La padrona di casa").click();
  await option(item(page, "s01.i02"), "Male: ha perso il treno.").click();
  const luggage = item(page, "s01.i03");
  for (const name of ["la valigia", "lo zaino", "l'ombrello"]) await option(luggage, name).click();
  await luggage.getByRole("button", { name: ui.lesson.check }).click();
  await expectCounter(page, 3, 3, 2);

  // Step 2: every article right.
  await next(page, "esercizi/2");
  const articles = item(page, "s02.i01");
  for (const [number, article] of [[1, "la"], [2, "lo"], [3, "l'"], [4, "il"]] as const) {
    await articles.getByLabel(ui.lesson.gapLabel(number)).selectOption(article);
  }
  await articles.getByRole("button", { name: ui.lesson.check }).click();
  await expectCounter(page, 1, 1, 1);

  // Step 3: one wrong plural article (lo instead of gli).
  await next(page, "esercizi/3");
  const plurals = item(page, "s03.i01");
  for (const [number, article] of [[1, "i"], [2, "lo"], [3, "gli"], [4, "le"], [5, "gli"]] as const) {
    await plurals.getByLabel(ui.lesson.gapLabel(number)).fill(article);
  }
  await plurals.getByRole("button", { name: ui.lesson.check }).click();
  await expectCounter(page, 1, 1, 0);

  // Step 4: the first sentence in the right order; the second is left untouched.
  await next(page, "esercizi/4");
  const sentence = item(page, "s04.i01");
  const tray = sentence.getByRole("group", { name: ui.lesson.tileTray });
  for (const tile of ["Bene,", "grazie,", "ma", "il treno", "era", "in ritardo", "."]) await option(tray, tile).click();
  await sentence.getByRole("button", { name: ui.lesson.check }).click();
  await expectCounter(page, 1, 2, 1);

  // Step 5: every exchange rated Bene.
  await next(page, "esercizi/5");
  for (const exchange of ["e1", "e2", "e3"]) {
    await option(page.locator(`li[data-exchange-id="${exchange}"]`), ui.lesson.rating.good).click();
  }
  await expectCounter(page, 3, 3, 0);

  // Step 6: Parla!, rated Bene.
  await next(page, "esercizi/6");
  await option(item(page, "s06.i01"), ui.lesson.rating.good).click();
  await expectCounter(page, 1, 1, 0);

  // Results: 4 of 7 points, 5 of 6 steps.
  await next(page, "risultati");
  await expect(shownText(page, ui.percent(57))).toBeVisible();
  await expect(shownText(page, ui.results.steps(5, 6))).toBeVisible();

  // The review sequence, then Finish.
  await page.getByRole("link", { name: ui.results.continue }).click();
  await expect(page).toHaveURL(`${LESSON}/grammatica/1`);
  await next(page, "grammatica/2");
  await next(page, "vocabolario");
  await next(page, "cultura");
  await page.getByRole("link", { name: ui.lesson.finishLesson }).click();
  await expect(page).toHaveURL(`${LESSON}/fine`);
  await expect(shownText(page, ui.percent(57))).toBeVisible();

  // Avanti after the level's only lesson: the overview, with the lesson completed.
  await page.getByRole("link", { name: ui.lesson.next, exact: true }).click();
  await expect(page).toHaveURL("/a2?completato=1");
  await expect(shownText(page, ui.level.completed)).toBeVisible();
  await expectCardStatus(card, ui.lessonStatus("completed", 57));

  // Saved, not just shown: the same after a reload, and step 1 reopens with its answers.
  await page.goto("/a2");
  await expectCardStatus(card, ui.lessonStatus("completed", 57));
  await page.goto(`${LESSON}/esercizi/1`);
  await expectCounter(page, 3, 3, 2);
});
