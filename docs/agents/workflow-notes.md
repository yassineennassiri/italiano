# Workflow notes

Things agents learned while building M1 that the code doesn't show. Read this before verifying anything in the browser or merging a PR.

## Working on issues

- **One chat per issue.** From M2 on, each `/implement #N` runs in its own chat. At the start, rename the chat to `#N short title` (for example `#37 Lesson 2 draft`) and file it in the sidebar section for its milestone (`italiano · M2`). Don't go on to the next issue in the same chat. Say which issue is next, and the user opens a new chat for it.
- **`Closes #N` goes in the PR body by hand.** The `pr` skill's template has no line for it. Put `Closes #N` at the top of the body, or the issue stays open after the merge.
- **Merge by hand.** Auto-merge is turned off for this repository. Check CI once with `gh pr checks <n>`. When it passes, run `gh pr merge <n> --squash --delete-branch`. Never merge while CI is failing.
- **Outside `/implement`, ask before committing or pushing.** Doc changes go on a branch with a PR, never straight to main.
- Each issue lists its blockers as native GitHub dependencies, plus a `Blocked by:` line. An issue is ready once all its blockers are closed.
- **Every issue belongs to a GitHub milestone** (`M1: …`, `M2: …`). A milestone that hasn't been grilled yet holds one `epic` issue with its scope. Epics are never implemented: grilling turns them into ready issues under the same milestone, and then the epic is closed.
- **The roadmap page** (`/roadmap`, `docs/roadmap/`) is how the user follows progress from their phone. New issues appear there under "Not on the map yet" until `/roadmap` places them in `docs/roadmap/features.json`.

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

## Cloud sessions

Issues can also run in a Claude Code cloud session (claude.ai/code), started and followed from the user's phone while their PC is off. The environment is set up as described in `setup.md` under "Cloud environment". This section covers what is different there.

- **How to tell.** `CLAUDE_CODE_REMOTE` is `true` in a cloud session, and never set locally. The machine is Ubuntu, so the Windows notes above (Git Bash heredocs, CRLF, `file:///C:/...` imports, `process.chdir("C:/dev/italiano")`) don't apply. Use the repo root you're in.
- **What loads.** `CLAUDE.md`, `.claude/skills/` and `.claude/settings.json` load. Plugins installed on a PC don't, so only the repo's skills are there: the issue workflow, `/roadmap`, and the grilling set (`/grill-with-docs`, `/grilling`, `/domain-modeling`, `/to-tickets`). Matt Pocock's other skills, such as diagnosing-bugs, aren't.
- **Packages.** The `SessionStart` hook in `.claude/settings.json` runs `npm ci` when `node_modules` is missing, and only in the cloud.
- **Both database variables point at Neon `dev`.** In the cloud, `DATABASE_URL` and `DATABASE_URL_TEST` are both the `dev` branch, so real progress on `main` can't be touched. The model can read environment variables, which is why `main`'s URL is never set there. Still verify with `npm run dev:test`.
- **No browser pane.** Verify with headless Playwright. Chrome for Testing is at `$CHROME_PATH` (`/usr/bin/google-chrome`), and `playwright.config.ts` uses it when the variable is set, so `npm run test:e2e` needs no `npx playwright install`. For a one-off check, a scratch Playwright script can launch `chromium.launch({ executablePath: process.env.CHROME_PATH })` against `http://localhost:3001`. This hasn't been tried yet: if it fails, say so in the issue comment instead of skipping the check silently.
- **Things only the user can check stay with the user:** Italian `speechSynthesis` voices, how a lesson sounds and looks, and `ready-for-human` issues. Stop and say so.
- **No sidebar.** The chat naming and sidebar steps under "Working on issues" don't apply. One cloud session per issue still does.

### GitHub commands in the cloud

`gh` is installed and already signed in through a proxy. Don't set `GH_TOKEN`. The proxy blocks GitHub's GraphQL API, so every `gh issue …` and `gh pr …` command fails with a 403. Use the REST API through `gh api` instead. Git pushes of branches work. Deleting a branch through the proxy is rejected, which is why the repository deletes merged branches by itself ("Automatically delete head branches").

Set `R=repos/yassineennassiri/italiano` first. Pass long text (comments, issue bodies, PR bodies) as a file with `-F body=@file.md`, which avoids quoting problems.

`N` is the issue number and `P` the PR number. Each line gives the cloud replacement for a command in the `CLAUDE.md` issue workflow.

- **List open issues** (instead of `gh issue list --state open`):
  ```sh
  gh api "$R/issues?state=open&per_page=100" --jq '.[] | select(.pull_request | not) | "#\(.number) \(.title)"'
  ```
- **Read an issue** (instead of `gh issue view N`): `gh api $R/issues/N --jq .body`
- **Check its blockers are closed:** read the issue's `Blocked by:` line, then run `gh api $R/issues/M --jq .state` for each blocker `M`.
- **Comment on an issue**, steps 2 and 10 (instead of `gh issue comment`): `gh api $R/issues/N/comments -F body=@comment.md`
- **Tick checkboxes**, step 6 (instead of `gh issue edit`): save the edited body to a file, then `gh api -X PATCH $R/issues/N -F body=@body.md`
- **Open the PR**, step 7 (instead of `gh pr create`): `git push -u origin HEAD`, then
  ```sh
  gh api $R/pulls -f title="…" -f head="$(git branch --show-current)" -f base=main -F body=@pr.md --jq .number
  ```
- **Check CI**, step 8 (instead of `gh pr checks P`):
  ```sh
  gh api "$R/commits/$(git rev-parse HEAD)/check-runs" --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
  ```
  Repeat every minute or two until every run says `completed`. All must say `success` before merging.
- **Squash-merge**, step 9 (instead of `gh pr merge P --squash --delete-branch`): `gh api -X PUT $R/pulls/P/merge -f merge_method=squash`. Don't delete the branch: GitHub does it.
- **Confirm the issue closed**, step 9: `gh api $R/issues/N --jq .state` should print `closed`.

The merge command works in the cloud (first used for #39, PR #65). If it ever fails, don't try workarounds: leave the PR open with green CI, comment on the issue that it's ready to merge, and tell the user.

### Creating issues in the cloud (`/to-tickets`)

- **Find the milestone's number:** `gh api "$R/milestones?state=all" --jq '.[] | select(.title | startswith("M3:")) | .number'`
- **Create an issue** (instead of `gh issue create`), with its label and milestone `M`:
  ```sh
  gh api $R/issues -f title="…" -F body=@issue.md -f "labels[]=ready-for-agent" -F milestone=M --jq .number
  ```
- **Add a blocking edge** (issue `N` is blocked by `B`). The API wants `B`'s internal id, not its number:
  ```sh
  gh api -X POST $R/issues/N/dependencies/blocked_by -F issue_id="$(gh api $R/issues/B --jq .id)"
  ```
  Check with `gh api $R/issues/N/dependencies/blocked_by --jq '[.[].number]'`.
- **Close the epic:** comment the list of new issues with `gh api $R/issues/E/comments -F body=@comment.md`, then `gh api -X PATCH $R/issues/E -f state=closed`.
