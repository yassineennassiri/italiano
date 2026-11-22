---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

Call the Skill tool twice, for "grilling" and "domain-modeling".

## In this repo

The user is a product owner and may answer from the Claude app on their phone, in a cloud session. Keep each round short enough to read on a phone, and put your recommended answer first so "yes" works.

**Grilling a milestone** (`/grill-with-docs M3`): the milestone's scope waits in its epic issue (the open issue labelled `epic` under that GitHub milestone).

1. Before the first round, read the epic and its open questions, SPEC §14 (the milestone list) and §15 (later features), `docs/course-plan.md`, `CONTEXT.md`, the ADRs in `docs/adr/`, and the decision logs at the end of SPEC (§16, §17, …) to see how earlier milestones were decided.
2. Grill until the milestone has a goal, an in-scope list in build order, an out-of-scope list and a *Done when* test, as SPEC §14.2 has for M2.
3. Write it down as you go, the way the M2 grilling did (commit `165a214`):
   - SPEC: a `### 14.N` section for the milestone, a new numbered `## Decision log (M<n> grilling, <date>)` section at the end of the decision logs, and changes in the sections each decision touches.
   - `CONTEXT.md` for new or sharpened terms, and ADRs only when `domain-modeling` says one is earned.
4. When the user confirms you've reached a shared understanding, put the doc changes on a branch and open a PR (`docs/agents/workflow-notes.md`; in a cloud session use the `gh api` commands under "Cloud sessions"). Ask before merging.
5. End with the **Next:** line from `CLAUDE.md` ("Always end with what's next"): merge the doc PR, then `/to-tickets M<n>`.
