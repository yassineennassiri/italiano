/**
 * Impostazioni (issue #50, SPEC §10.1): reached from the hamburger; the
 * default subtitles and speed are synced and a scene player opens with
 * them; *Ripasso personale* off removes the step and on brings it back; the
 * Italian voice is this computer's own, kept in localStorage. Runs against
 * the Neon `dev` branch only (the global setup checks).
 */
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { PROFILE_ID, profile, reviewCard, reviewLog } from "@/db/schema";
import { ui } from "@/ui-it";
import { hydrated, LESSON, resetLesson, shownText, spokenVoices, useStandInVoice } from "./helpers";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON_2 = "/a2/la-casa-della-signora-pina";
const SETTINGS = "/impostazioni";

const savedSettings = async () => (await db.select({ settings: profile.settings }).from(profile).where(eq(profile.id, PROFILE_ID)))[0]?.settings;
const clearSettings = () => db.update(profile).set({ settings: {} }).where(eq(profile.id, PROFILE_ID));

async function clearCards(): Promise<void> {
  await db.delete(reviewLog).where(eq(reviewLog.userId, PROFILE_ID));
  await db.delete(reviewCard).where(eq(reviewCard.userId, PROFILE_ID));
}

/** Opens Impostazioni and waits until it can be used. */
async function openSettings(page: Page): Promise<void> {
  await page.goto(SETTINGS);
  await hydrated(page.getByRole("checkbox", { name: new RegExp(ui.settings.ripasso) }));
}

test.beforeEach(clearSettings);

test.afterAll(async () => {
  await clearSettings();
  await clearCards();
});

test("Impostazioni is reached from the hamburger", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: ui.topBar.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("link", { name: ui.topBar.settings, exact: true }).click();
  await expect(page).toHaveURL(SETTINGS);
  await expect(page.getByRole("heading", { name: ui.settings.heading, level: 1 })).toBeVisible();
});

test("a scene player opens with the saved default subtitles and speed", async ({ page }) => {
  await useStandInVoice(page);
  await openSettings(page);
  await page.getByRole("group", { name: ui.settings.subtitles }).getByRole("radio", { name: ui.lesson.player.subtitleModes.it_en }).check();
  await page.getByRole("group", { name: ui.settings.speed }).getByRole("radio", { name: ui.lesson.player.speeds.slow }).check();
  await expect.poll(savedSettings).toEqual({ subtitles: "it_en", scene_speed: 0.75 });

  // Saved: a reload shows them, as the other computer would.
  await page.reload();
  await expect(page.getByRole("group", { name: ui.settings.subtitles }).getByRole("radio", { name: ui.lesson.player.subtitleModes.it_en })).toBeChecked();
  await expect(page.getByRole("group", { name: ui.settings.speed }).getByRole("radio", { name: ui.lesson.player.speeds.slow })).toBeChecked();

  await page.goto(`${LESSON}/info`);
  const play = page.getByRole("button", { name: ui.lesson.player.play, exact: true });
  await hydrated(play);
  await play.click();
  const pressed = (group: string, name: string) =>
    expect(page.getByRole("group", { name: group }).getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await pressed(ui.lesson.player.subtitles, ui.lesson.player.subtitleModes.it_en);
  await pressed(ui.lesson.player.speed, ui.lesson.player.speeds.slow);

  // Changing them in the player changes only that player.
  await page.getByRole("group", { name: ui.lesson.player.subtitles }).getByRole("button", { name: ui.lesson.player.subtitleModes.off, exact: true }).click();
  await expect.poll(savedSettings).toEqual({ subtitles: "it_en", scene_speed: 0.75 });
});

test("turning Ripasso personale off removes the step from lessons, and on brings it back", async ({ page }) => {
  await clearCards();
  await resetLesson(page, LESSON_2);
  await db.insert(reviewCard).values({
    id: randomUUID(),
    userId: PROFILE_ID,
    kind: "item",
    refId: "a2.u01.l01.s01.i02",
    dueAt: new Date(Date.now() - 60_000),
    intervalDays: 1,
    ease: 2.5,
  });
  const ripassoHeading = page.getByRole("heading", { name: ui.lesson.ripasso.title, level: 1 });

  await page.goto(`${LESSON_2}/esercizi/11`);
  await expect(ripassoHeading).toBeVisible();
  await expect(shownText(page, ui.lesson.stepCounter(11, 12)).first()).toBeVisible();

  await openSettings(page);
  const toggle = page.getByRole("checkbox", { name: new RegExp(ui.settings.ripasso) });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(savedSettings).toEqual({ inject_review: false });
  await page.goto(`${LESSON_2}/esercizi/11`);
  await expect(shownText(page, ui.lesson.stepCounter(11, 11)).first()).toBeVisible();
  await expect(ripassoHeading).toHaveCount(0);

  await openSettings(page);
  await page.getByRole("checkbox", { name: new RegExp(ui.settings.ripasso) }).check();
  await expect.poll(savedSettings).toEqual({ inject_review: true });
  await page.goto(`${LESSON_2}/esercizi/11`);
  await expect(ripassoHeading).toBeVisible();
  await expect(shownText(page, ui.lesson.stepCounter(11, 12)).first()).toBeVisible();

  await resetLesson(page, LESSON_2);
});

test("the voice picker lists the Italian voices, keeps the choice on this computer, and the scene player speaks with it", async ({ page }) => {
  await useStandInVoice(page, ["Voce di prova", "Seconda voce"]);
  await openSettings(page);
  const picker = page.getByRole("combobox", { name: ui.settings.voice });
  await expect(picker.getByRole("option")).toHaveText(["Voce di prova", "Seconda voce"]);
  await expect(picker).toHaveValue("Voce di prova");
  await picker.selectOption("Seconda voce");

  await page.reload();
  await expect(page.getByRole("combobox", { name: ui.settings.voice })).toHaveValue("Seconda voce");
  // Not synced: nothing reaches profile.settings.
  expect(await savedSettings()).toEqual({});

  await page.goto(`${LESSON}/info`);
  const play = page.getByRole("button", { name: ui.lesson.player.play, exact: true });
  await hydrated(play);
  await play.click();
  await expect.poll(async () => (await spokenVoices(page))[0]).toBe("Seconda voce");
});
