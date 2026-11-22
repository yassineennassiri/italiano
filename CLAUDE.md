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
10. Comment a short summary on the issue and tell me which issue is next.
Never merge with failing CI. HITL issues (ready-for-human): stop and ask me.

In a cloud session (`CLAUDE_CODE_REMOTE` is `true`), `gh issue` and `gh pr` don't work. Before step 1, read "Cloud sessions" in `docs/agents/workflow-notes.md`, and use the `gh api` commands it gives for each step.
