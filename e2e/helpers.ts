/** Helpers shared by the e2e specs. */
import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { ui } from "@/ui-it";

/** The example lesson, A2.1.1. */
export const LESSON = "/a2/benvenuto-a-genova";

/** Text on the page that is shown: Next keeps the pages navigated away from in the DOM, hidden. */
export const shownText = (page: Page, text: string | RegExp) => page.getByText(text, { exact: typeof text === "string" }).filter({ visible: true });

/** The step footer's counter shows `completed` of `total` exercises and `points` (SPEC §6.2). */
export const expectCounter = (page: Page, completed: number, total: number, points: number) =>
  expect(shownText(page, ui.lesson.footerCounter({ completed, total, points }))).toBeVisible();

/** Waits until React has hydrated the element, so a click isn't lost on a freshly loaded page. */
export async function hydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber"))))
    .toBe(true);
}

/**
 * Starts waiting for the next `router.refresh()`; the returned promise settles
 * once its request has ended and the browser has painted twice since, so React
 * has applied the payload. Next marks the refresh's request with an `RSC: 1`
 * header (a server action's POST carries `Next-Action` instead), and often
 * aborts it once it has read the payload: an abort counts as ended too.
 */
export function nextRefresh(page: Page): Promise<void> {
  const ended = new Promise<void>((resolve) => {
    const onEnd = (request: Request) => {
      if (request.headers()["rsc"] !== "1") return;
      page.off("requestfinished", onEnd);
      page.off("requestfailed", onEnd);
      resolve();
    };
    page.on("requestfinished", onEnd);
    page.on("requestfailed", onEnd);
  });
  return ended.then(() => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
}

/** Resets one lesson with the lesson menu's *Azzera*, from its intro page (e.g. `/a2/la-casa-della-signora-pina`). */
export async function resetLesson(page: Page, lessonPath: string): Promise<void> {
  await page.goto(`${lessonPath}/info`);
  const menu = page.getByRole("button", { name: ui.lesson.openMenu, exact: true });
  await hydrated(menu);
  await menu.click();
  await page.getByRole("button", { name: ui.reset.lessonButton, exact: true }).click();
  const refreshed = nextRefresh(page);
  await page.getByRole("dialog").getByRole("button", { name: ui.reset.confirm, exact: true }).click();
  await refreshed;
}

/**
 * Gives the page a stand-in Italian `speechSynthesis` that records what it is
 * asked to say and ends each utterance quickly, so a test hears nothing and
 * doesn't depend on the computer's voices. Read what it said with `spoken`.
 * Call it before the first `goto`.
 */
export async function useStandInVoice(page: Page): Promise<void> {
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
}

/** What the stand-in voice (`useStandInVoice`) was asked to say, in order. */
export const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spokenLines: string[] }).spokenLines);
