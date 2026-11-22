/**
 * Issue #36, SPEC §4.10 and §7.1: when an Azzera dialog closes, by *Annulla*,
 * Escape or confirming, keyboard focus goes back to the control that opened
 * it. For the lesson menu that is the lesson bar's chevron, since the menu
 * item is hidden by then; for the level overview it is the *Azzera* button.
 *
 * Each dialog is opened two ways. By keyboard, where focus must also be
 * visible afterwards. And by a click that doesn't focus the button it lands
 * on, as in Firefox and Safari on macOS: there the browser's own focus
 * restore has nothing to go back to, so only the app can return it.
 *
 * Runs against the Neon `dev` branch only (the global setup checks). The
 * confirm cases reset A2.1.1 and the level on `dev`, which the happy path
 * resets again before it starts.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { hydrated, LESSON, nextRefresh } from "./helpers";

/** How a button is pressed. */
type Press = (button: Locator) => Promise<void>;

const openings: { name: string; press: Press; focusVisible: boolean }[] = [
  {
    name: "keyboard",
    press: async (button) => {
      await button.focus();
      await button.press("Enter");
    },
    focusVisible: true,
  },
  // A synthetic click runs the button's handler without focusing it.
  { name: "a click that doesn't focus", press: (button) => button.dispatchEvent("click"), focusVisible: false },
];

const closings: { name: string; close: (dialog: Locator, press: Press) => Promise<void> }[] = [
  { name: "Annulla", close: (dialog, press) => press(dialog.getByRole("button", { name: ui.reset.cancel, exact: true })) },
  { name: "Escape", close: (dialog) => dialog.page().keyboard.press("Escape") },
  {
    name: "confirming",
    // Confirming reloads the page's server data once the reset has landed: focus is checked after that too.
    close: async (dialog, press) => {
      const refreshed = nextRefresh(dialog.page());
      await press(dialog.getByRole("button", { name: ui.reset.confirm, exact: true }));
      await refreshed;
    },
  },
];

/** Each Azzera dialog: where it lives, the control focus returns to, and how to open it from there. */
const dialogs: { name: string; opener: string; path: string; openerOf: (page: Page) => Locator; open: (page: Page, press: Press) => Promise<void> }[] = [
  {
    name: "lesson menu",
    opener: "chevron",
    path: `${LESSON}/info`,
    openerOf: (page) => page.getByRole("button", { name: ui.lesson.openMenu, exact: true }),
    open: async (page, press) => {
      await press(page.getByRole("button", { name: ui.lesson.openMenu, exact: true }));
      await press(page.getByRole("button", { name: ui.reset.lessonButton, exact: true }));
    },
  },
  {
    name: "level overview",
    opener: "Azzera button",
    path: "/a2",
    // The dialog's own confirm button is also called Azzera: the opener comes first.
    openerOf: (page) => page.getByRole("button", { name: ui.reset.levelButton, exact: true }).first(),
    open: (page, press) => press(page.getByRole("button", { name: ui.reset.levelButton, exact: true }).first()),
  },
];

for (const target of dialogs) {
  for (const opening of openings) {
    for (const closing of closings) {
      test(`${target.name} Azzera dialog, opened by ${opening.name}, closed by ${closing.name}: focus returns to the ${target.opener}`, async ({ page }) => {
        await page.goto(target.path);
        const opener = target.openerOf(page);
        await hydrated(opener);
        await target.open(page, opening.press);

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await closing.close(dialog, opening.press);

        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        if (opening.focusVisible) expect(await opener.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
      });
    }
  }
}
