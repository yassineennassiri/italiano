/**
 * Top error tags and tag drills (issue #47): the review hub lists the top
 * error tags by unresolved error_log rows of the last 30 days, or an empty
 * state; clicking a tag starts a drill of that tag's exercises from completed
 * lessons, graded like a review. It updates an existing item card with source
 * `drill` and creates no cards. Runs against the Neon `dev` branch only (the
 * global setup checks); the test writes its error_log rows directly.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { errorLog, lessonProgress, PROFILE_ID, reviewCard, reviewLog } from "@/db/schema";
import { RECENT_DAYS } from "@/review/top-tags";
import { ui } from "@/ui-it";
import { hydrated, LESSON, resetLesson, shownText } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const DROPDOWN = "a2.u01.l01.s02.i01";
const days = (count: number) => new Date(Date.now() + count * 86_400_000);

async function clearHistory(): Promise<void> {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
  await db.delete(errorLog).where(eq(errorLog.userId, PROFILE_ID));
}

test.afterAll(clearHistory);

test("with no recent unresolved errors, the panel says so", async ({ page }) => {
  await clearHistory();
  await db.insert(errorLog).values([
    { userId: PROFILE_ID, source: "exercise", errorTags: ["article.lo"], resolved: true },
    { userId: PROFILE_ID, source: "exercise", errorTags: ["article.lo"], createdAt: days(-31) },
  ]);
  await page.goto("/ripasso");
  await expect(shownText(page, ui.review.topTags.none(RECENT_DAYS))).toBeVisible();
});

test("the top tags count recent unresolved errors, and a tag's drill grades its exercises like a review", async ({ page }) => {
  await clearHistory();
  // A2.1.1 completed: the drill takes its exercises from it.
  await resetLesson(page, LESSON);
  await page.goto(`${LESSON}/fine`);
  await expect
    .poll(async () => (await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, PROFILE_ID), eq(lessonProgress.lessonId, "a2.u01.l01"))))[0]?.status)
    .toBe("completed");

  const row = (errorTags: string[], fields: Partial<typeof errorLog.$inferInsert> = {}) => ({ userId: PROFILE_ID, source: "exercise" as const, errorTags, ...fields });
  await db.insert(errorLog).values([
    row(["article.elision"], { itemId: DROPDOWN, createdAt: days(-1) }),
    row(["article.elision", "register.lei"], { createdAt: days(-20) }),
    row(["article.lo"], { resolved: true }),
    row(["prep.articulated"], { createdAt: days(-40) }),
  ]);
  // The dropdown has an item card, not due: the drill grades it all the same.
  const cardId = randomUUID();
  await db.insert(reviewCard).values({ id: cardId, userId: PROFILE_ID, kind: "item", refId: DROPDOWN, dueAt: days(3), intervalDays: 6, ease: 2.5, reps: 2, streak: 2 });
  const cardsBefore = (await db.select().from(reviewCard).where(eq(reviewCard.userId, PROFILE_ID))).length;

  await page.goto("/ripasso");
  const panel = page.getByRole("region", { name: ui.review.topTags.heading });
  const tags = panel.getByRole("listitem");
  await expect(tags).toHaveCount(2);
  await expect(tags.nth(0)).toContainText("article.elision");
  await expect(tags.nth(0)).toContainText(ui.review.topTags.count(2));
  await expect(tags.nth(1)).toContainText("register.lei");
  await expect(tags.nth(1)).toContainText(ui.review.topTags.count(1));

  const link = tags.nth(0).getByRole("link");
  await hydrated(link);
  await link.click();
  await expect(page).toHaveURL("/ripasso/errori/article.elision");
  await expect(shownText(page, ui.review.drill.heading("article.elision"))).toBeVisible();

  // Lesson 1's article.elision exercises: the dropdown, a word order and three speaking exchanges; never Parla!.
  for (let number = 1; number <= 5; number++) {
    await expect(shownText(page, ui.review.counter(number, 5))).toBeVisible();
    const solve = page.getByRole("button", { name: ui.lesson.solve, exact: true });
    const notGreat = page.getByRole("button", { name: ui.lesson.rating.not_great, exact: true });
    await expect(solve.or(notGreat)).toBeVisible();
    const answer = (await solve.isVisible()) ? solve : notGreat;
    await hydrated(answer);
    await answer.click();
    await page.getByRole("button", { name: number === 5 ? ui.review.finish : ui.review.next, exact: true }).click();
  }
  await expect(shownText(page, ui.review.summaryCount({ vocab: 0, item: 5, error: 0 }))).toBeVisible();
  await expect(shownText(page, ui.review.gradeCount("again", 5))).toBeVisible();

  // The dropdown's card was graded again, logged as a drill; no card was created.
  await expect.poll(async () => (await db.select().from(reviewLog).where(eq(reviewLog.userId, PROFILE_ID))).map((log) => [log.cardId, log.grade, log.source])).toEqual([
    [cardId, "again", "drill"],
  ]);
  const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
  expect(cards).toHaveLength(cardsBefore);
  expect(cards.find((card) => card.id === cardId)).toMatchObject({ lastResult: "again", streak: 0, lapses: 1 });
});
