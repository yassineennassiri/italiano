# Setting up Claude Code for this repo

The project's knowledge lives in the repo: `SPEC.md`, `CONTEXT.md`, `docs/adr/`, `docs/course-plan.md`, `CLAUDE.md`, and `docs/agents/`, including `workflow-notes.md`. The `tdd`, `code-review`, `pr` and `implement` skills are in `.claude/skills/`. Chats and memory belong to a Claude account and machine. Nothing in them is needed to continue.

## New Claude account on a computer that already runs the app

1. Sign in to Claude Code with the new account.
2. Install Matt Pocock's skills, which provide grilling, domain-modeling, codebase-design, diagnosing-bugs and others. They're in the official marketplace:
   ```
   /plugin install mattpocock-skills
   ```
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
