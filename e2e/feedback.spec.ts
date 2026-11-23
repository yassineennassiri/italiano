/**
 * Feedback notes (issue #51, SPEC §10.6): the level overview's card saves a
 * level note; *Segnala un problema* on step 4 of lesson 2 saves a lesson note
 * on that page; `/feedback` lists the open notes by lesson and *Fatto* marks
 * one done. Runs against the Neon `dev` branch only (the global setup checks).
 */
import { expect, type Page, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { feedbackNote, PROFILE_ID } from "@/db/schema";
import { ui } from "@/ui-it";
import { hydrated } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON_2 = "/a2/la-casa-della-signora-pina";

const clearNotes = () => db.delete(feedbackNote).where(eq(feedbackNote.userId, PROFILE_ID));
const savedNotes = async () =>
  (await db.select({ scope: feedbackNote.scope, refId: feedbackNote.refId, text: feedbackNote.text, done: feedbackNote.done }).from(feedbackNote).where(eq(feedbackNote.userId, PROFILE_ID)));

test.beforeEach(clearNotes);
test.afterAll(clearNotes);

/** Opens *Segnala un problema* from the lesson menu on the page shown. */
async function openReport(page: Page): Promise<void> {
  const menu = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("button", { name: ui.feedback.report, exact: true }).click();
}

test("the level overview's Feedback card saves a level note", async ({ page }) => {
  await page.goto("/a2");
  const card = page.getByRole("region", { name: ui.feedback.levelCard });
  const save = card.getByRole("button", { name: ui.feedback.save });
  await hydrated(save);
  await expect(save).toBeDisabled();
  await card.getByLabel(ui.feedback.note).fill("Manca il test finale.");
  await save.click();
  await expect(card.getByRole("status")).toHaveText(ui.feedback.saved);
  await expect(card.getByLabel(ui.feedback.note)).toHaveValue("");
  await expect.poll(savedNotes).toEqual([{ scope: "level", refId: "a2", text: "Manca il test finale.", done: false }]);
});

test("Segnala un problema on step 4 of lesson 2 saves a note on that page", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/4`);
  await openReport(page);
  const dialog = page.getByRole("dialog", { name: ui.feedback.report });
  await dialog.getByLabel(ui.feedback.note).fill("Il gap 2 accetta solo «un'».");
  await dialog.getByRole("button", { name: ui.feedback.send }).click();
  await expect(dialog.getByRole("status")).toHaveText(ui.feedback.sent);
  await expect.poll(savedNotes).toEqual([{ scope: "lesson", refId: "a2.u01.l02/esercizi/4", text: "Il gap 2 accetta solo «un'».", done: false }]);

  await dialog.getByRole("button", { name: ui.feedback.close }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: ui.lesson.openMenu, exact: true })).toBeFocused();
});

test("Annulla closes Segnala un problema without saving", async ({ page }) => {
  await page.goto(`${LESSON_2}/info`);
  await openReport(page);
  const dialog = page.getByRole("dialog", { name: ui.feedback.report });
  await dialog.getByLabel(ui.feedback.note).fill("Non la mando.");
  await dialog.getByRole("button", { name: ui.feedback.cancel }).click();
  await expect(dialog).toBeHidden();
  // The next opening starts empty, and a note saved then is the only one: the cancelled text was never queued.
  await openReport(page);
  await expect(dialog.getByLabel(ui.feedback.note)).toHaveValue("");
  await dialog.getByLabel(ui.feedback.note).fill("Questa sì.");
  await dialog.getByRole("button", { name: ui.feedback.send }).click();
  await expect.poll(savedNotes).toEqual([{ scope: "lesson", refId: "a2.u01.l02/info", text: "Questa sì.", done: false }]);
});

test("/feedback lists the open notes by lesson, and Fatto marks one done", async ({ page }) => {
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000);
  await db.insert(feedbackNote).values([
    { id: crypto.randomUUID(), userId: PROFILE_ID, scope: "lesson", refId: "a2.u01.l02/esercizi/4", text: "Nota sulla lezione 2.", createdAt: at(3) },
    { id: crypto.randomUUID(), userId: PROFILE_ID, scope: "lesson", refId: "a2.u01.l01/vocabolario", text: "Nota sulla lezione 1.", createdAt: at(2) },
    { id: crypto.randomUUID(), userId: PROFILE_ID, scope: "level", refId: "a2", text: "Nota sul livello.", createdAt: at(1) },
    { id: crypto.randomUUID(), userId: PROFILE_ID, scope: "level", refId: "a2", text: "Già fatta.", done: true },
  ]);

  await page.goto("/");
  const menu = page.getByRole("button", { name: ui.topBar.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("link", { name: ui.topBar.feedback, exact: true }).click();
  await expect(page).toHaveURL("/feedback");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Ripasso A2", "Benvenuto a Genova!", "La casa della signora Pina"]);
  await expect(page.getByText("Già fatta.")).toHaveCount(0);
  const lesson2 = page.getByRole("region", { name: "La casa della signora Pina" });
  await expect(lesson2.getByText("a2.u01.l02/esercizi/4")).toBeVisible();

  const done = lesson2.getByRole("checkbox", { name: ui.feedback.done });
  await hydrated(done);
  await done.check();
  await expect
    .poll(async () => (await db.select({ done: feedbackNote.done }).from(feedbackNote).where(and(eq(feedbackNote.userId, PROFILE_ID), eq(feedbackNote.text, "Nota sulla lezione 2."))))[0]?.done)
    .toBe(true);

  await page.reload();
  await expect(page.getByText("Nota sulla lezione 2.")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Ripasso A2", "Benvenuto a Genova!"]);
});
