---
name: roadmap
description: Refresh the user's roadmap page (milestones, features and issue status, built from the GitHub issues) and republish it at its fixed claude.ai link. Use when the user runs /roadmap, asks to update or refresh the roadmap, or a milestone has just finished or been grilled into issues.
---

# Roadmap

The roadmap page shows the user, a product owner, where the app stands: each milestone, its features in build order, and every issue's status in plain words. They read it on their phone, so it is written from a learner's side, not in code terms.

It lives at a fixed link. Always republish to it; never create a new artifact:

**https://claude.ai/artifact/LyHDvxTR4TNV4qb7NxQhAs**

## Files

- `docs/roadmap/features.json`: the hand-written map. Milestones (matching the GitHub milestones titled `M1: …`), their features in build order, each feature's issues in build order with a plain-language `label`, and for a milestone not yet grilled, its `epic` issue and `sketch` of scope.
- `scripts/roadmap.mts` (`npm run roadmap`): reads the map, adds each issue's status from GitHub through `gh api` (works locally and in cloud sessions), and writes `docs/roadmap/roadmap.json`. That file is generated and git-ignored.
- `docs/roadmap/index.html`: the page. It loads `roadmap.json` from beside itself.

## Steps

1. `git pull` on `main`, so `features.json` is current.
2. Run `npm run roadmap`. It prints one line per milestone, and lists open issues that aren't on the map.
3. If issues are missing from the map, add each one to `features.json`:
   - Put it under its milestone (its GitHub milestone, or the `Blocked by:` chain and SPEC §14 if it has none), in the feature it belongs to, at its place in the build order. Make a new feature when none fits, placed by build order too.
   - Write `label` as a learner would say it ("Fill the gaps from a word bank"), not the issue title ("Item type word_bank"). Keep feature names and `about` lines in the same voice.
   - When a milestone has just been grilled into issues, replace its `sketch` with real features, and drop its `epic` once the epic issue is closed.
   - Run `npm run roadmap` again until nothing is unmapped.
4. Publish:
   - Read the artifact first (`Artifact` with `action: "read"` and the link above). A publish to an artifact this conversation hasn't read is refused.
   - Then publish `docs/roadmap/index.html` to that `url`, with `files: {"roadmap.json": "docs/roadmap/roadmap.json"}`. Don't pass `icon`.
   - If there's no Artifact tool in this session, or the publish fails, say so plainly. `roadmap.json` is still up to date on disk, and the page can be republished from a desktop session.
5. If `features.json` changed, it needs a PR like any doc change (`docs/agents/workflow-notes.md`). Outside `/implement`, ask the user before committing. In a cloud session, use the `gh api` commands under "Cloud sessions" in the workflow notes.
6. Tell the user in two or three plain sentences what changed since the last refresh: what got done, what is being built, what is ready, and what is waiting on them. Give the link.
7. End with the **Next:** line from `CLAUDE.md` ("Always end with what's next").

## Page conventions

Keep these when editing the page:
- Colors: grey is not started, orange is under way, green only at 100%, blue is ready to start, violet marks what needs the user.
- Features are one numbered column in build order, and the page says so.
- Milestones not yet grilled show their goal, the scope cards from `sketch`, and links to their epic and GitHub milestone.
