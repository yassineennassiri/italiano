/**
 * The Ripasso personale step (issue #48, ADR-0005): a due item card from
 * A2.1.1 comes back in A2.1.2 as an extra step before Parla!. It counts in the
 * footer but never scores, its answer grades the card, it is still answered
 * after a reload, and Azzera clears the choice. With `inject_review` off
 * there is no step. Runs against the Neon `dev` branch only (the global setup
 * checks). Cards come due tomorrow, so the test writes a due card itself.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { lessonProgress, PROFILE_ID, profile, reviewCard, reviewLog } from "@/db/schema";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, resetLesson, shownText } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON_2 = "/a2/la-casa-della-signora-pina";
const I02 = "a2.u01.l01.s01.i02";

async function clearCards(): Promise<void> {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
}

const storedChoice = async () =>
  (
    await db
      .select({ reviewItems: lessonProgress.reviewItems })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, PROFILE_ID), eq(lessonProgress.lessonId, "a2.u01.l02")))
  )[0]?.reviewItems;

/** A2.1.1's item i02 of step 1, due a minute ago. */
async function dueCard(): Promise<string> {
  const id = randomUUID();
  await db.insert(reviewCard).values({ id, userId: PROFILE_ID, kind: "item", refId: I02, dueAt: new Date(Date.now() - 60_000), intervalDays: 1, ease: 2.5 });
  return id;
}

test.afterAll(async () => {
  await clearCards();
  await db.update(profile).set({ settings: {} }).where(eq(profile.id, PROFILE_ID));
});

test("a due item card from another lesson comes back before Parla!, unscored, and grades its card", async ({ page }) => {
  await clearCards();
  await resetLesson(page, LESSON_2);
  const cardId = await dueCard();

  // The step sits before Parla!: the lesson's 11 steps become 12.
  await page.goto(`${LESSON_2}/esercizi/11`);
  await expect(page.getByRole("heading", { name: ui.lesson.ripasso.title, level: 1 })).toBeVisible();
  await expect(shownText(page, ui.lesson.ripasso.instruction)).toBeVisible();
  await expect(shownText(page, ui.lesson.stepCounter(11, 12)).first()).toBeVisible();
  expect(await storedChoice()).toEqual([I02]);
  await expectCounter(page, 0, 1, 0);

  // A right first Check: completed, but no point. The card is graded good, with source ripasso_personale.
  const right = page.locator(`section[data-item-id="${I02}"]`).getByRole("button", { name: "Bene, ma il treno era in ritardo.", exact: true });
  await hydrated(right);
  await right.click();
  await expectCounter(page, 1, 1, 0);
  await expect
    .poll(() => db.select({ grade: reviewLog.grade, source: reviewLog.source }).from(reviewLog).where(eq(reviewLog.cardId, cardId)))
    .toEqual([{ grade: "good", source: "ripasso_personale" }]);

  // After a reload the step is the same and its answer is still given.
  await page.reload();
  await expect(shownText(page, ui.lesson.stepCounter(11, 12)).first()).toBeVisible();
  await expectCounter(page, 1, 1, 0);

  // Avanti goes on to Parla!, now step 12.
  await page.getByRole("link", { name: ui.lesson.next, exact: true }).click();
  await expect(page).toHaveURL(`${LESSON_2}/esercizi/12`);
  await expect(shownText(page, ui.lesson.stepCounter(12, 12)).first()).toBeVisible();

  // Azzera clears the choice.
  await resetLesson(page, LESSON_2);
  expect(await storedChoice()).toBeNull();
});

test("there is no step with inject_review off", async ({ page }) => {
  await clearCards();
  await db.update(profile).set({ settings: { inject_review: false } }).where(eq(profile.id, PROFILE_ID));
  await resetLesson(page, LESSON_2);
  await dueCard();

  await page.goto(`${LESSON_2}/esercizi/11`);
  await expect(shownText(page, ui.lesson.stepCounter(11, 11)).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: ui.lesson.ripasso.title })).toHaveCount(0);
  await page.goto(`${LESSON_2}/esercizi/12`);
  await expect(page.getByRole("heading", { name: ui.notFound.heading })).toBeVisible();
});
