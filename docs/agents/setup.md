# Setting up Claude Code for this repo

The project's knowledge lives in the repo: `SPEC.md`, `CONTEXT.md`, `docs/adr/`, `docs/course-plan.md`, `CLAUDE.md`, and `docs/agents/`, including `workflow-notes.md`. The `tdd`, `code-review`, `pr`, `implement` and `roadmap` skills are in `.claude/skills/`. Chats and memory belong to a Claude account and machine. Nothing in them is needed to continue.

The roadmap page is at https://claude.ai/artifact/LyHDvxTR4TNV4qb7NxQhAs. It's private to the Claude account that published it, so after switching accounts, publish it once as a new artifact and put the new link in `.claude/skills/roadmap/SKILL.md` and here.

## New Claude account on a computer that already runs the app

1. Sign in to Claude Code with the new account.
2. Install Matt Pocock's skills, which provide grilling, domain-modeling, codebase-design, diagnosing-bugs and others, for the whole account. The official marketplace may not be configured on the computer, so add Matt's repo as a marketplace:
   ```
   claude plugin marketplace add mattpocock/skills --scope user
   claude plugin install mattpocock-skills@mattpocock --scope user
   ```
   The plugin also has `tdd`, `pr`, `code-review` and `implement`, listed as `mattpocock-skills:tdd` and so on. Keep the repo's own copies in `.claude/skills/`: `tdd` and `pr` are edited to use `CONTEXT.md`, and cloud sessions don't load plugins.
3. Open a chat in `C:\dev\italiano`.
4. Set the model's effort level to high.
5. In the sidebar, create the sections `italiano · M1`, `italiano · M2` and `italiano · M3`.
6. Check that `gh auth status` shows the `yassineennassiri` GitHub account, and that `.env.local` exists. Neither depends on the Claude account.
7. Start the next issue: `gh issue list --state open` shows them. M2 is #36–#55, and the build order is in SPEC §14.2. Run `/implement #N` in a new chat.

## New computer

Do the per-computer app setup from SPEC §8 first:

1. `git clone`
2. `npm i`
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `DATABASE_URL_TEST`.
4. `npm run dev`
5. `npx playwright install chromium`, for the end-to-end tests.

The migrations and the seed have already run on both Neon branches, so they don't need repeating. Then follow the steps above.

## Cloud environment

Cloud sessions at claude.ai/code run issues on Anthropic's machines, so work goes on while the PC is off. You start and follow them from the Claude app on your phone. Everything Claude needs to know is in the repo (see "Cloud sessions" in `workflow-notes.md`). These settings live outside it, so set them once by hand:

1. **Connect GitHub.** At claude.ai/code, connect your GitHub account and install the Claude GitHub App on the `yassineennassiri/italiano` repository.
2. **Create a cloud environment** for the repo, named `italiano`:
   - **Network access:** *Limited*, with *Allow package managers* ticked, and `*.neon.tech` added to the allowed domains (the app's database).
   - **Environment variables:** both on the Neon `dev` branch, never `main`, because Claude can read these values:
     ```
     DATABASE_URL=<the dev connection string>
     DATABASE_URL_TEST=<the same dev connection string>
     ```
     The dev connection string is the `DATABASE_URL_TEST` line in `.env.local` on your PC.
   - **Setup script:** leave it empty. The repo's `SessionStart` hook installs the npm packages.
3. **Let GitHub delete merged branches.** On github.com, in the repository's *Settings → General → Pull Requests*, tick *Automatically delete head branches*. Cloud sessions can't delete branches themselves.
4. **Start an issue from your phone.** In the Claude app, open Code, start a session on `yassineennassiri/italiano` with the `italiano` environment, and type `/implement #N`. One session per issue, as locally. `ready-for-human` issues stay with you.

The first cloud issue is also the test of two things that haven't been tried yet: merging through `gh api`, and checking the app with headless Chrome. If either fails, the session should stop and say so.
