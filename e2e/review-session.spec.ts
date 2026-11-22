/**
 * Review cards (issue #44): a wrong first Check in A2.1.1 makes an item card;
 * once it is due, a review session from `/ripasso` re-asks it in the normal
 * item UI, grades it and reschedules it, and the lesson's own progress stays
 * as it was. Vocab cards (issue #45): the Finish screen makes them, and a
 * session mixes them with item cards as flip cards graded by the learner. Runs against the Neon `dev` branch only (the global setup
 * checks). Cards come due tomorrow, so the test moves its card's due date
 * back in the database.
 */
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { PROFILE_ID, reviewCard, reviewLog } from "@/db/schema";
import { loadLesson } from "@/content/load";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, LESSON, resetLesson, shownText } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const I02 = "a2.u01.l01.s01.i02";

const profileCards = () => db.select().from(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));

async function clearCards(): Promise<void> {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
}

async function openMainMenu(page: Page): Promise<void> {
  const menu = page.getByRole("button", { name: ui.topBar.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
}

test.afterAll(clearCards);

test("a wrong first Check comes back in a review session, which grades it without changing the lesson", async ({ page }) => {
  await clearCards();
  await resetLesson(page, LESSON);

  // A wrong first Check on step 1 makes a card, due tomorrow.
  await page.goto(`${LESSON}/esercizi/1`);
  const item = page.locator(`section[data-item-id="${I02}"]`);
  const wrong = item.getByRole("button", { name: "Male: ha perso il treno.", exact: true });
  await hydrated(wrong);
  await wrong.click();
  await expectCounter(page, 1, 3, 0);
  await expect(page.getByRole("status").filter({ hasText: ui.footer.sync.saved })).toBeVisible();
  await expect.poll(async () => (await profileCards()).map((card) => card.refId)).toEqual([I02]);
  const [card] = await profileCards();
  expect(card.dueAt.getTime()).toBeGreaterThan(Date.now());

  // Not due yet.
  await openMainMenu(page);
  await page.getByRole("link", { name: ui.topBar.review, exact: true }).click();
  await expect(page).toHaveURL("/ripasso");
  await expect(shownText(page, ui.review.nothingDue)).toBeVisible();

  // Once due, the hub counts it and the session re-asks it.
  await db
    .update(reviewCard)
    .set({ dueAt: new Date(Date.now() - 60_000) })
    .where(and(eq(reviewCard.userId, PROFILE_ID), eq(reviewCard.id, card.id)));
  await page.reload();
  await expect(shownText(page, ui.review.dueCount({ vocab: 0, item: 1 }))).toBeVisible();
  await page.getByRole("link", { name: ui.review.start, exact: true }).click();
  await expect(page).toHaveURL("/ripasso/sessione");
  await expect(shownText(page, ui.review.counter(1, 1))).toBeVisible();
  const right = page.locator(`section[data-item-id="${I02}"]`).getByRole("button", { name: "Bene, ma il treno era in ritardo.", exact: true });
  await hydrated(right);
  await right.click();
  await page.getByRole("button", { name: ui.review.finish, exact: true }).click();
  await expect(shownText(page, ui.review.summaryCount({ vocab: 0, item: 1 }))).toBeVisible();
  await expect(shownText(page, ui.review.gradeCount("good", 1))).toBeVisible();

  // Graded good and rescheduled: nothing left to review today.
  await page.getByRole("link", { name: ui.review.backToHub, exact: true }).click();
  await expect(page).toHaveURL("/ripasso");
  await expect(shownText(page, ui.review.nothingDue)).toBeVisible();
  const [reviewed] = await profileCards();
  expect(reviewed).toMatchObject({ reps: 1, streak: 1, lastResult: "good" });
  expect(reviewed.dueAt.getTime()).toBeGreaterThan(Date.now());

  // The lesson still shows the wrong first Check: no point.
  await page.goto(`${LESSON}/esercizi/1`);
  await expectCounter(page, 1, 3, 0);
});

test("finishing makes vocab cards, and a session mixes a flip card with an item card", async ({ page }) => {
  await clearCards();
  const vocab = loadLesson("a2.u01.l01")!.vocab;

  // Reaching the Finish screen makes one vocab card per entry, due tomorrow.
  await page.goto(`${LESSON}/fine`);
  await expect.poll(async () => (await profileCards()).filter((card) => card.kind === "vocab").length).toBe(vocab.length);

  // One vocab card and one item card come due.
  const ombrello = (await profileCards()).find((card) => card.refId === "a2.u01.l01.v-ombrello")!;
  const past = new Date(Date.now() - 60_000);
  await db.update(reviewCard).set({ dueAt: past }).where(eq(reviewCard.id, ombrello.id));
  await db.insert(reviewCard).values({ id: randomUUID(), userId: PROFILE_ID, kind: "item", refId: I02, dueAt: past, intervalDays: 1, ease: 2.5 });

  await page.goto("/ripasso");
  await expect(shownText(page, ui.review.dueCount({ vocab: 1, item: 1 }))).toBeVisible();
  await page.getByRole("link", { name: ui.review.start, exact: true }).click();
  await expect(page).toHaveURL("/ripasso/sessione");

  const flipCard = page.locator('section[data-vocab-id="v-ombrello"]');
  for (let card = 0; card < 2; card++) {
    const flip = flipCard.getByRole("button", { name: ui.review.flip, exact: true });
    const itemAnswer = page.locator(`section[data-item-id="${I02}"]`).getByRole("button", { name: "Bene, ma il treno era in ritardo.", exact: true });
    await expect(flip.or(itemAnswer)).toBeVisible();
    if (await flip.isVisible()) {
      // The front: the English meaning only, no Italian and no gender dot.
      await expect(flipCard.getByText("umbrella", { exact: true })).toBeVisible();
      await expect(flipCard.getByText("l'ombrello")).toHaveCount(0);
      await expect(flipCard.getByTitle(ui.lesson.gender.m)).toHaveCount(0);
      await hydrated(flip);
      await flip.click();
      // The back: the term with article and plural, 🔊, and the four grades.
      await expect(flipCard.getByText(ui.lesson.nounWithPlural("l'ombrello", "gli ombrelli"))).toBeVisible();
      await expect(flipCard.getByRole("button", { name: ui.lesson.listen })).toBeVisible();
      for (const grade of ["again", "hard", "good", "easy"] as const) {
        await expect(flipCard.getByRole("button", { name: ui.review.grade[grade], exact: true })).toBeVisible();
      }
      await flipCard.getByRole("button", { name: ui.review.grade.hard, exact: true }).click();
    } else {
      await hydrated(itemAnswer);
      await itemAnswer.click();
      await page.getByRole("button", { name: card === 1 ? ui.review.finish : ui.review.next, exact: true }).click();
    }
  }
  await expect(shownText(page, ui.review.summaryCount({ vocab: 1, item: 1 }))).toBeVisible();
  await expect(shownText(page, ui.review.gradeCount("hard", 1))).toBeVisible();

  // The vocab card was graded hard and logged.
  await page.getByRole("link", { name: ui.review.backToHub, exact: true }).click();
  await expect(shownText(page, ui.review.nothingDue)).toBeVisible();
  const [graded] = await db.select().from(reviewCard).where(eq(reviewCard.id, ombrello.id));
  expect(graded).toMatchObject({ reps: 1, lastResult: "hard" });
  expect(await db.select().from(reviewLog).where(inArray(reviewLog.cardId, [ombrello.id]))).toMatchObject([{ grade: "hard", source: "hub" }]);
});

test("the review hub is reachable from the lesson menu and the level overview", async ({ page }) => {
  await page.goto(`${LESSON}/info`);
  const menu = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("link", { name: ui.lesson.menu.strumenti, exact: true }).click();
  await expect(page).toHaveURL("/ripasso");

  await page.goto("/a2");
  await page.getByRole("link", { name: new RegExp(ui.level.moreLessons) }).click();
  await expect(page).toHaveURL("/ripasso");
});
