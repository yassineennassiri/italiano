/**
 * The IndexedDB write queue (issue #43, SPEC §8): an answer given while the
 * server can't be reached is kept on this computer, survives a reload, shows
 * in a second tab, and is sent once, by one tab, when the server is back.
 * "Offline" here blocks the progress Server Actions only (the page itself
 * still loads), as when a work network blocks the database but not the app.
 */
import { type BrowserContext, expect, type Page, type Request, test } from "@playwright/test";
import { ui } from "@/ui-it";
import { expectCounter, hydrated, LESSON, resetLesson, shownText } from "./helpers";

const STEP = `${LESSON}/esercizi/1`;
const isProgressWrite = (request: Request) => request.method() === "POST" && request.headers()["next-action"] !== undefined;

/** Blocks the progress writes of every tab; returns the function that lets them through again. */
async function blockWrites(context: BrowserContext): Promise<() => Promise<void>> {
  const handler = (route: Parameters<Parameters<BrowserContext["route"]>[1]>[0]) =>
    isProgressWrite(route.request()) ? route.abort("internetdisconnected") : route.fallback();
  await context.route("**/*", handler);
  return () => context.unroute("**/*", handler);
}

const syncStatus = (page: Page, status: keyof typeof ui.footer.sync) => expect(shownText(page, ui.footer.sync[status])).toBeVisible();

test("an answer given offline survives a reload, shows in a second tab, and is sent once when back online", async ({ page, context }) => {
  await resetLesson(page, LESSON);
  await page.goto(STEP);
  const option = page.locator('section[data-item-id="a2.u01.l01.s01.i01"]').getByRole("button", { name: "La padrona di casa", exact: true });
  await hydrated(option);
  await expectCounter(page, 0, 3, 0);

  const unblock = await blockWrites(context);
  await option.click();
  await expectCounter(page, 1, 3, 1);
  await syncStatus(page, "stored");

  // A reload, still offline: the answer is still there, laid over the server's empty state.
  await page.reload();
  await expectCounter(page, 1, 3, 1);
  await syncStatus(page, "stored");

  // A second tab shows it too.
  const second = await context.newPage();
  await second.goto(STEP);
  await expectCounter(second, 1, 3, 1);

  // Back online: one tab sends the answer, once.
  const picks: Request[] = [];
  for (const tab of [page, second]) {
    tab.on("request", (request) => {
      if (isProgressWrite(request) && request.postData()?.includes('"kind":"pick"')) picks.push(request);
    });
  }
  await unblock();
  for (const tab of [page, second]) await tab.evaluate(() => window.dispatchEvent(new Event("online")));
  await syncStatus(page, "saved");
  await syncStatus(second, "saved");
  expect(picks).toHaveLength(1);

  // The server has it: a fresh page shows it from the database.
  await second.close();
  await page.reload();
  await expectCounter(page, 1, 3, 1);
  await syncStatus(page, "saved");
});

test("without IndexedDB, an answer given offline waits in memory and the footer says Offline: non salvato", async ({ page, context }) => {
  // Blocked storage: reading `indexedDB` throws, as with site data blocked.
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get: () => {
        throw new DOMException("Storage is blocked.", "SecurityError");
      },
    }),
  );
  await resetLesson(page, LESSON);
  await page.goto(STEP);
  const option = page.locator('section[data-item-id="a2.u01.l01.s01.i01"]').getByRole("button", { name: "La padrona di casa", exact: true });
  await hydrated(option);

  const unblock = await blockWrites(context);
  await option.click();
  await expectCounter(page, 1, 3, 1);
  await syncStatus(page, "offline");

  await unblock();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await syncStatus(page, "saved");
  await page.reload();
  await expectCounter(page, 1, 3, 1);
});
