/**
 * Corrections and error cards (issue #46): *Aggiungi una correzione* in the
 * review hub can't be saved with a blank text; saving writes a manual
 * error_log row with its tags and an error card due tomorrow. Once due, a
 * review session shows the wrong version struck through, *Info* reveals the
 * tag's explanation, and an accent-only miss is graded *hard*. Runs against
 * the Neon `dev` branch only; the test moves its card's due date back.
 */
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { errorLog, PROFILE_ID, reviewCard, reviewLog } from "@/db/schema";
import { loadErrorTags } from "@/content/load";
import { ui } from "@/ui-it";
import { hydrated, shownText } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const GIVEN = "voglio che tu esse felice";
const EXPECTED = "Voglio che tu sia felice, però.";
const TAG = "congiuntivo.volere_che";

async function clearCorrections(): Promise<void> {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
  await db.delete(errorLog).where(and(eq(errorLog.userId, PROFILE_ID), eq(errorLog.source, "manual")));
}

test.afterAll(clearCorrections);

test("a correction saved in the hub comes back as an error card, and an accent-only miss grades it hard", async ({ page }) => {
  await clearCorrections();
  await page.goto("/ripasso");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: ui.review.correction.save }) });
  const save = form.getByRole("button", { name: ui.review.correction.save, exact: true });
  const given = form.getByLabel(ui.review.correction.given, { exact: true });
  const expected = form.getByLabel(ui.review.correction.expected, { exact: true });
  await hydrated(save);

  // Blank texts can't be saved.
  await expect(save).toBeDisabled();
  await given.fill(GIVEN);
  await expected.fill("   ");
  await expect(save).toBeDisabled();
  await given.fill("");
  await expected.fill(EXPECTED);
  await expect(save).toBeDisabled();

  await given.fill(GIVEN);
  await form.getByLabel(TAG, { exact: true }).check();
  await form.getByLabel(ui.review.correction.note, { exact: true }).fill("dal tutor");
  await save.click();
  await expect(shownText(page, ui.review.correction.saved)).toBeVisible();
  await expect(given).toHaveValue("");

  // A manual error_log row with its tag, and its error card, due tomorrow.
  await expect
    .poll(() => db.select().from(errorLog).where(and(eq(errorLog.userId, PROFILE_ID), eq(errorLog.source, "manual"))))
    .toMatchObject([{ given: GIVEN, expected: EXPECTED, errorTags: [TAG], note: "dal tutor", resolved: false }]);
  const [row] = await db.select().from(errorLog).where(and(eq(errorLog.userId, PROFILE_ID), eq(errorLog.source, "manual")));
  await expect.poll(() => db.select().from(reviewCard).where(eq(reviewCard.userId, PROFILE_ID))).toMatchObject([{ kind: "error", refId: row.id }]);
  const [card] = await db.select().from(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
  expect(card.dueAt.getTime()).toBeGreaterThan(Date.now());
  await page.reload();
  await expect(shownText(page, ui.review.nothingDue)).toBeVisible();

  // Once due, the session shows it as an error card.
  await db.update(reviewCard).set({ dueAt: new Date(Date.now() - 60_000) }).where(eq(reviewCard.id, card.id));
  await page.reload();
  await expect(shownText(page, ui.review.dueCount({ vocab: 0, item: 0, error: 1 }))).toBeVisible();
  await page.getByRole("link", { name: ui.review.start, exact: true }).click();
  await expect(page).toHaveURL("/ripasso/sessione");
  const errorCard = page.locator(`section[data-error-card="${card.id}"]`);
  await expect(errorCard.locator("del", { hasText: GIVEN })).toBeVisible();

  // Info shows the tag's English explanation.
  const explanation = loadErrorTags().find((tag) => tag.id === TAG)!.explanation_en;
  const info = errorCard.getByRole("button", { name: ui.review.info, exact: true });
  await hydrated(info);
  await expect(errorCard.getByText(explanation)).toHaveCount(0);
  await info.click();
  await expect(errorCard.getByText(explanation)).toBeVisible();

  // An accent-only miss: red, with the accent hint, and graded hard.
  const input = errorCard.getByRole("textbox", { name: ui.review.errorInput, exact: true });
  await input.fill("Voglio che tu sia felice, pero.");
  await input.press("Enter");
  await expect(errorCard.getByText(ui.lesson.accentHint, { exact: true })).toBeVisible();
  await expect(input).toBeEditable();
  await page.getByRole("button", { name: ui.review.finish, exact: true }).click();
  await expect(shownText(page, ui.review.summaryCount({ vocab: 0, item: 0, error: 1 }))).toBeVisible();
  await expect(shownText(page, ui.review.gradeCount("hard", 1))).toBeVisible();

  await page.getByRole("link", { name: ui.review.backToHub, exact: true }).click();
  await expect(shownText(page, ui.review.nothingDue)).toBeVisible();
  await expect.poll(() => db.select().from(reviewCard).where(eq(reviewCard.id, card.id))).toMatchObject([{ lastResult: "hard", streak: 1 }]);
  expect(await db.select().from(reviewLog).where(eq(reviewLog.cardId, card.id))).toMatchObject([{ grade: "hard", source: "hub" }]);
});
