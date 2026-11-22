/**
 * Issue #36, SPEC §4.10 and §7.1: when an Azzera dialog closes, by *Annulla*,
 * Escape or confirming, keyboard focus goes back to the control that opened
 * it. For the lesson menu that is the lesson bar's chevron, since the menu
 * item is hidden by then; for the level overview it is the *Azzera* button.
 * Runs against the Neon `dev` branch only (the global setup checks). The
 * confirm cases reset A2.1.1 and the level on `dev`, which the happy path
 * resets again before it starts.
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

type Closing = { name: string; close: (dialog: Locator, page: Page) => Promise<void> };

const closings: Closing[] = [
  { name: "Annulla", close: (dialog) => dialog.getByRole("button", { name: ui.reset.cancel, exact: true }).click() },
  { name: "Escape", close: (_dialog, page) => page.keyboard.press("Escape") },
  {
    name: "confirming",
    // Confirming reloads the page's server data once the reset has landed: wait for that
    // refresh too, so focus is checked after it and not only in the moment the dialog closes.
    close: async (dialog, page) => {
      const refreshed = page.waitForResponse((response) => response.request().headers()["rsc"] === "1");
      await dialog.getByRole("button", { name: ui.reset.confirm, exact: true }).click();
      await refreshed;
    },
  },
];

for (const { name, close } of closings) {
  test(`closing the lesson menu's Azzera dialog by ${name} returns focus to the chevron`, async ({ page }) => {
    await page.goto(`${LESSON}/info`);
    const chevron = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
    await hydrated(chevron);
    await chevron.click();
    await page.getByRole("button", { name: ui.reset.lessonButton, exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await close(dialog, page);

    await expect(dialog).toBeHidden();
    await expect(chevron).toBeFocused();
  });

  test(`closing the level overview's Azzera dialog by ${name} returns focus to its Azzera button`, async ({ page }) => {
    await page.goto("/a2");
    // The dialog's own confirm button is also called Azzera: the opener is the one outside it.
    const azzera = page.getByRole("button", { name: ui.reset.levelButton, exact: true }).first();
    await hydrated(azzera);
    await azzera.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await close(dialog, page);

    await expect(dialog).toBeHidden();
    await expect(azzera).toBeFocused();
  });
}
