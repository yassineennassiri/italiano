# Workflow notes

Things agents learned while building M1 that the code doesn't show. Read this before verifying anything in the browser or merging a PR.

## Working on issues

- **One chat per issue.** From M2 on, each `/implement #N` runs in its own chat. At the start, rename the chat to `#N short title` (for example `#37 Lesson 2 draft`) and file it in the sidebar section for its milestone (`italiano · M2`). Don't go on to the next issue in the same chat. Say which issue is next, and the user opens a new chat for it.
- **`Closes #N` goes in the PR body by hand.** The `pr` skill's template has no line for it. Put `Closes #N` at the top of the body, or the issue stays open after the merge.
- **Merge by hand.** Auto-merge is turned off for this repository. Check CI once with `gh pr checks <n>`. When it passes, run `gh pr merge <n> --squash --delete-branch`. Never merge while CI is failing.
- **Outside `/implement`, ask before committing or pushing.** Doc changes go on a branch with a PR, never straight to main.
- Each issue lists its blockers as native GitHub dependencies, plus a `Blocked by:` line. An issue is ready once all its blockers are closed.

## Real data vs test data

- Neon branch `main` (`DATABASE_URL`) holds the user's real progress. Don't touch it without asking.
- Verify progress features with `npm run dev:test` (launch config `dev-test`, port 3001, Neon `dev` branch), never with `npm run dev`. Afterwards, clean up the fixed profile's rows on `dev`.
- `npm run dev` and `npm run dev:test` share `.next/`, so run only one at a time.
- Playwright (`npm run test:e2e`) runs locally against `dev` only. It needs `npx playwright install chromium` once per computer.
- Scratch `tsx` scripts outside the repo have to do three things:
  - import project files and npm packages as `file:///C:/dev/italiano/...` URLs, e.g. `file:///C:/dev/italiano/node_modules/drizzle-orm/index.js`;
  - call `process.chdir("C:/dev/italiano")`;
  - only then call `loadLocalEnv()`.

## Verifying in the app's browser pane

- **A hidden pane stops the app from starting.** When `tabs_context` says the pane is hidden, `requestAnimationFrame` never fires. Next's streamed `<Suspense>` content never appears and the page never hydrates: clicks do nothing, effects don't run, and screenshots time out.
  - Opening the page with `preview_start {url}` usually brings the pane forward.
  - If it stays hidden, clicks sent through `javascript_tool` still work.
  - A `<dialog>`'s `close` event never fires in a hidden pane, so focus return after closing a dialog can't be verified there.
- **Port 3001:** the `navigate` tool has refused `http://localhost:3001`. `preview_start {url}`, or `location.assign()` run inside the page, both work.
- **The previous route stays in the DOM, hidden.** After client navigation, Next keeps the old page hidden, so `document.querySelector` can match an element on it, e.g. `a[rel=next]`. Scope the query to the visible page, or reload with `location.assign`.
- **The pane has no Italian `speechSynthesis` voice** (it has six voices, none `it-IT`). It can only verify the no-voice fallback; real Chrome or Edge voices need the user. To test that an MP3 takes priority, use a dummy MP3 made of silent MPEG frames written with node.

## Shell

- In this Git Bash setup, heredocs containing quotes can fail to parse ("unexpected EOF while looking for matching"). Write multi-line scripts to a file in the scratchpad and run that file instead.
- Files are checked out with CRLF line endings. Git's "LF will be replaced by CRLF" warnings are harmless.
