# italiano

@AGENTS.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues for yassineennassiri/italiano (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Workflow notes and setup

Read `docs/agents/workflow-notes.md` before verifying in the browser, touching the database or merging: it covers one chat per issue, merging by hand, Neon `dev` vs `main`, and browser-pane traps. Setting up a new Claude account or computer: `docs/agents/setup.md`.

### Project commands

The project's slash commands are skills in `.claude/skills/`: `/implement`, `/tdd`, `/code-review`, `/pr`, `/roadmap`, `/grill-with-docs`, `/grilling`, `/domain-modeling` and `/to-tickets`. A session only knows the skills that existed when it started. If I type one of these and it isn't recognised, run `git pull`, then read `.claude/skills/<name>/SKILL.md` and follow it. Don't improvise a substitute.

## Issue workflow
When I run /implement #N:
1. Sync main (git pull), then create a branch issue-N-short-name.
2. Comment on the issue: "Started on branch issue-N-...".
3. Implement with the tdd skill. Don't ask me for seams: pick them from the issue's acceptance criteria and note them in the issue comment.
4. Run lint, typecheck and the full test suite. All must pass.
5. Run the code-review skill against main. Fix every real finding, re-run checks.
6. Tick each acceptance-criteria checkbox in the issue body that is actually met. If one can't be met, stop and comment why.
7. Push the branch and open a PR using the pr skill, with "Closes #N" in the body.
8. Wait for GitHub Actions CI to pass on the PR.
9. Squash-merge the PR, delete the branch, and confirm the issue closed.
10. Comment a short summary on the issue, then end with the **Next:** line (see below).
11. In a cloud session, chain to the next issue (see below).
Never merge with failing CI. HITL issues (ready-for-human): stop and ask me.

## Chaining issues (cloud sessions only)
So I don't have to start every issue by hand, a cloud `/implement` run starts the next one itself. The commands are under "Chaining issues" in `docs/agents/workflow-notes.md`.
- **Start the next issue** in a new cloud session, only when all of these hold: this issue's PR merged with green CI, the issue is closed, no PR is open, and the **Next:** line is "Claude can take the next issue" with an issue in the **same milestone**. Start exactly one, and say in the **Next:** line that it started.
- **Otherwise stop**: the next issue is mine, the milestone is finished, or the run stopped on a problem. Never start an issue in another milestone: a new milestone needs grilling with me first. Send me a phone notification with the **Next:** line when the tool is there.
- **Survive the usage limit.** A session cut off by the limit doesn't restart by itself. So push the branch after every commit from step 3 on, and right after step 2 schedule a check-in to this session 5 hours later that carries on from where the run stopped. Cancel it at the end of step 10.

## Always end with what's next
I follow the work from my phone and I'm not a developer. So every piece of work ends with a **Next:** line telling me exactly what to do, even when I didn't ask: an issue finished, a milestone finished, a grilling done, tickets created, the roadmap refreshed, or a session that had to stop.

Run `npm run roadmap` to see the current state, then pick:
- **Claude can take the next issue:** an open `ready-for-agent` issue whose blockers are all closed and that has no open PR, taking the first one in build order in `docs/roadmap/features.json`. Say `/implement #N` and that it goes in a **new** session, with its plain-language label from `features.json`. List the other ready issues on an "Also ready:" line.
- **Only my issues are ready** (`ready-for-human`): say which one and what I do, in plain words (for example "play lesson 2 to the end and note problems").
- **A milestone's last Claude issue is done:** say that only my acceptance check is left, and which issue it is.
- **A milestone is finished:** suggest `/roadmap`, then `/grill-with-docs M<n+1>` for the next milestone.
- **A grilling is done:** merge its doc PR, then `/to-tickets M<n>`.
- **Tickets are created:** `/implement #N` for the first ready one.
- **A PR waits for my approval, or the session stopped on a problem:** say exactly what I need to decide or do first.

Format:
> **Next:** `/implement #40` in a new session: Fill the gaps from a word bank (M2, step 3).
> Also ready: #42, #49. Waiting on you: #19, the final check on two computers.

In a cloud session (`CLAUDE_CODE_REMOTE` is `true`), `gh issue` and `gh pr` don't work. Before step 1, read "Cloud sessions" in `docs/agents/workflow-notes.md`, and use the `gh api` commands it gives for each step.
