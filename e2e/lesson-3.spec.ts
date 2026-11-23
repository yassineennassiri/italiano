/**
 * Issue #53: the A2.1.3 draft, *Il vicino di casa*, plays to the Finish
 * screen with no placeholder card on any step. Choice items are answered
 * right, every other checkable item is solved with *Soluzione*, and every
 * speaking exercise is rated *Bene*, so each step ends complete.
 *
 * Runs against the Neon `dev` branch only (the global setup checks). It
 * deletes the profile's review cards first, so no Ripasso personale step is
 * added before Parla! (ADR-0005), and resets A2.1.3 with *Azzera*.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { PROFILE_ID, reviewCard, reviewLog } from "@/db/schema";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, resetLesson, shownText } from "./helpers";

const LESSON_3 = "/a2/il-vicino-di-casa";
const lesson = loadLesson("a2.u01.l03")!;

loadLocalEnv();
const db = connect(databaseUrl("dev"));

const shown = (locator: Locator) => locator.filter({ visible: true });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** An option button by its text; once checked, its name also carries the ✓ / ✗ label. */
const option = (scope: Locator, text: string) => scope.getByRole("button", { name: new RegExp(`^${escape(text)}( |$)`) });

async function next(page: Page, path: string): Promise<void> {
  await page.getByRole("link", { name: ui.lesson.next, exact: true }).click();
  await expect(page).toHaveURL(`${LESSON_3}/${path}`);
}

test("plays A2.1.3 to the Finish screen, with no placeholder on any step", async ({ page }) => {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
  await resetLesson(page, LESSON_3);

  await page.goto(`${LESSON_3}/info`);
  await page.getByRole("link", { name: ui.lesson.start }).click();

  let points = 0;
  let scorable = 0;
  for (const [index, step] of lesson.steps.entries()) {
    await expect(page).toHaveURL(`${LESSON_3}/esercizi/${index + 1}`);
    await expect(shownText(page, ui.lesson.unbuiltItem)).toHaveCount(0);

    let exercises = 0;
    let stepPoints = 0;
    for (const item of step.items) {
      const section = shown(page.locator(`section[data-item-id="${item.id}"]`));
      await expect(section).toBeVisible();
      if (item.type === "speak_rate") {
        for (const exchange of item.exchanges) {
          const rate = section.locator(`li[data-exchange-id="${exchange.id}"]`).getByRole("button", { name: ui.lesson.rating.good, exact: true });
          await hydrated(rate);
          await rate.click();
          exercises += 1;
        }
        continue;
      }
      exercises += 1;
      if (item.type === "parla") {
        const rate = section.getByRole("button", { name: ui.lesson.rating.good, exact: true });
        await hydrated(rate);
        await rate.click();
        continue;
      }
      scorable += 1;
      if (item.type === "single_choice" || item.type === "audio_choice" || item.type === "image_choice") {
        const right = option(section, item.options[item.answer]);
        await hydrated(right);
        await right.click();
        stepPoints += 1;
      } else {
        const solve = section.getByRole("button", { name: ui.lesson.solve, exact: true });
        await hydrated(solve);
        await solve.click();
      }
    }
    points += stepPoints;
    await expectCounter(page, exercises, exercises, stepPoints);

    await next(page, index + 1 < lesson.steps.length ? `esercizi/${index + 2}` : "risultati");
  }

  // Results: every step complete, and the points from the choice items.
  // 8 choice items answered right, 15 scorable items (ADR-0002).
  expect([points, scorable]).toEqual([8, 15]);
  const percent = 53;
  await expect(shownText(page, ui.percent(percent))).toBeVisible();
  await expect(shownText(page, ui.results.steps(lesson.steps.length, lesson.steps.length))).toBeVisible();

  // The review sequence, then Finish.
  await page.getByRole("link", { name: ui.results.continue }).click();
  await expect(page).toHaveURL(`${LESSON_3}/grammatica/1`);
  await next(page, "grammatica/2");
  await next(page, "vocabolario");
  await next(page, "cultura");
  await page.getByRole("link", { name: ui.lesson.finishLesson }).click();
  await expect(page).toHaveURL(`${LESSON_3}/fine`);
  await expect(shownText(page, ui.percent(percent))).toBeVisible();
});
