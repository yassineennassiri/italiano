/**
 * Vocab links (issue #49, SPEC §4.3): in A2.1.1, a linked word in a prompt and
 * in the Copione shows a dotted underline and opens a popover with the term,
 * its plural, gender dot, English and 🔊, on hover, click and Enter; Esc
 * closes it. Reads pages only, so it writes no progress.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { hydrated, LESSON } from "./helpers";

/** The visible vocab link to `vocabId` inside `scope`. */
const vocabLink = (scope: Locator | Page, vocabId: string) => scope.locator(`[data-vocab-link="${vocabId}"]`).filter({ visible: true });

/** The popover a vocab link controls. */
async function popoverOf(page: Page, link: Locator): Promise<Locator> {
  return page.locator(`[id="${await link.getAttribute("aria-controls")}"]`);
}

test("a prompt's vocab link opens its popover on hover, click and Enter, and Esc closes it", async ({ page }) => {
  await page.goto(`${LESSON}/esercizi/1`);
  const prompt = page.locator('section[data-item-id="a2.u01.l01.s01.i02"]');
  const link = vocabLink(prompt, "v-viaggio");
  await hydrated(link);
  await expect(link).toHaveText("viaggio");
  await expect(link).toHaveCSS("text-decoration-style", "dotted");
  const popover = await popoverOf(page, link);
  await expect(popover).toBeHidden();

  // Hover opens it; leaving closes it.
  await link.hover();
  await expect(popover).toBeVisible();
  await expect(popover).toContainText(ui.lesson.nounWithPlural("il viaggio", "i viaggi"));
  await expect(popover).toContainText(ui.lesson.genderLabel("m").trim());
  await expect(popover).toContainText("journey, trip");
  await expect(popover.getByRole("button", { name: ui.lesson.listen })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(popover).toBeHidden();

  // A click keeps it open after the mouse leaves; Esc closes it and focus stays on the link.
  await link.click();
  await page.mouse.move(0, 0);
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(link).toBeFocused();

  // Enter on the focused link opens it.
  await page.keyboard.press("Enter");
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});

test("the Copione's vocab links open their popover, and the rest of the line still shows its English", async ({ page }) => {
  await page.goto(`${LESSON}/esercizi/1`);
  const toggle = page.getByRole("button", { name: ui.lesson.script, exact: true });
  await hydrated(toggle);
  await toggle.click();

  const line = page.locator('li[data-line-id="L4"]').filter({ visible: true });
  const link = vocabLink(line, "v-ritardo");
  await expect(link).toHaveText("in ritardo");
  const popover = await popoverOf(page, link);
  await link.click();
  await expect(popover).toContainText("late, delayed");

  // Clicking the line away from the link (its start, "Bene") toggles its English.
  await page.keyboard.press("Escape");
  const translation = line.getByRole("button", { name: ui.lesson.showTranslation });
  // The link is an inline-block, so the computed description has a space after it.
  await expect(translation).toHaveAccessibleDescription(/^Bene, grazie\. Il treno era un po' in ritardo ?, ma va bene così\.$/);
  await translation.click({ position: { x: 5, y: 5 } });
  await expect(translation).toHaveAttribute("aria-expanded", "true");
  await expect(line.getByText("Fine, thanks. The train was a bit late, but that's OK.")).toBeVisible();
});
