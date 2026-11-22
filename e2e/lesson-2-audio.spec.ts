/**
 * Issue #39, SPEC §5.2.8 and §9.1: in A2.1.2, an `audio_choice` item's 🔊
 * speaks exactly its clip's scene lines in order and checks like
 * `single_choice`, and a step with `media.kind: "clip"` shows the clip player,
 * which plays only that span.
 *
 * The browser gets a stand-in Italian `speechSynthesis` that records what it
 * is asked to say and ends each utterance quickly, so the test hears nothing
 * and doesn't depend on the computer's voices.
 *
 * Runs against the Neon `dev` branch only (the global setup checks), and
 * resets A2.1.2 first with the lesson menu's *Azzera*.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, nextRefresh, shownText } from "./helpers";

const LESSON_2 = "/a2/la-casa-della-signora-pina";

const item = (page: Page, id: string) => page.locator(`section[data-item-id="a2.u01.l02.${id}"]`);
const option = (scope: Locator, text: string) =>
  scope.getByRole("button", { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`) });
const shown = (locator: Locator) => locator.filter({ visible: true });

/** What the stand-in voice was asked to say, in order. */
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spokenLines: string[] }).spokenLines);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { spokenLines: string[] }).spokenLines = said;
    const voice = { lang: "it-IT", name: "Voce di prova", default: true, localService: true, voiceURI: "test" };
    class Utterance {
      lang = "";
      voice: unknown = null;
      rate = 1;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    let current: Utterance | undefined;
    const synthesis = {
      getVoices: () => [voice],
      speak: (utterance: Utterance) => {
        current = utterance;
        said.push(utterance.text);
        setTimeout(() => {
          if (current === utterance) utterance.onend?.();
        }, 150);
      },
      cancel: () => {
        const cancelled = current;
        current = undefined;
        cancelled?.onerror?.({ error: "canceled" });
      },
      addEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synthesis, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  });

  await page.goto(`${LESSON_2}/info`);
  const menu = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("button", { name: ui.reset.lessonButton, exact: true }).click();
  const refreshed = nextRefresh(page);
  await page.getByRole("dialog").getByRole("button", { name: ui.reset.confirm, exact: true }).click();
  await refreshed;
});

test("audio_choice: 🔊 speaks exactly the clip's lines in order, and picks check like single_choice", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/5`);
  await expect(shownText(page, ui.lesson.unbuiltItem)).toHaveCount(0);

  // L11 to L13 of the scene.
  const electrician = item(page, "s05.i02");
  const listen = electrician.getByRole("button", { name: ui.lesson.listen, exact: true });
  await hydrated(listen);
  await listen.click();
  await expect.poll(() => spoken(page)).toEqual([
    "Che bello! Ma c'è un problema: in cucina la luce non funziona.",
    "Ah, sì, il problema della luce… Domani chiamo un elettricista.",
    "Non serve, signora: sono un ingegnere elettrico!",
  ]);
  await expect(listen).toHaveAttribute("aria-pressed", "false");

  // Right at once: a point, and the other options lock.
  await option(electrician, "perché è un ingegnere elettrico.").click();
  await expectCounter(page, 1, 2, 1);
  await expect(option(electrician, "perché la luce funziona già.")).toBeDisabled();

  // Wrong: the others stay open, and the right retry scores nothing.
  const lift = item(page, "s05.i01");
  await option(lift, "Sì, l'ascensore è a destra.").click();
  await expectCounter(page, 2, 2, 1);
  await expect(option(lift, "No, caro, ci sono solo le scale.")).toBeEnabled();
  await option(lift, "No, caro, ci sono solo le scale.").click();
  await expect(option(lift, "No, caro, ci sono solo le scale.")).toBeDisabled();
  await expectCounter(page, 2, 2, 1);
});

test("a clip step shows the clip player at the top, which plays only its span", async ({ page }) => {
  await page.goto(`${LESSON_2}/esercizi/10`);

  const player = shown(page.getByRole("group", { name: ui.lesson.clipPlayer.label }));
  await expect(player).toBeVisible();
  await expect(player.getByText(ui.lesson.player.lineOf(1, 4), { exact: true })).toBeVisible();
  await expect(player.getByText(/^~\d\d:\d\d$/)).toBeVisible();
  // At the top of the step, above its title.
  const title = shown(page.getByRole("heading", { name: "In che ordine?", level: 1 }));
  expect((await player.boundingBox())!.y).toBeLessThan((await title.boundingBox())!.y);

  const play = player.getByRole("button", { name: ui.lesson.clipPlayer.play, exact: true });
  await hydrated(play);
  await play.click();
  await expect(player.getByRole("button", { name: ui.lesson.clipPlayer.pause, exact: true })).toBeVisible();
  // L5 to L8 of the scene, and nothing else.
  await expect.poll(() => spoken(page)).toEqual([
    "Ecco la chiave. Attenzione, la porta è un po' dura.",
    "Allora: questa è la cucina, con un frigorifero e una lavatrice.",
    "E c'è anche un bagno?",
    "Certo: un bagno piccolo, con una doccia. E qui c'è una camera da letto con un armadio.",
  ]);
  await expect(player.getByText(ui.lesson.player.lineOf(4, 4), { exact: true })).toBeVisible();
  await expect(play).toBeVisible();
  expect(await spoken(page)).toHaveLength(4);
});
