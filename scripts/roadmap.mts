/**
 * `npm run roadmap`: builds docs/roadmap/roadmap.json, the data behind the
 * roadmap page (docs/roadmap/index.html). It reads the hand-written feature map
 * in docs/roadmap/features.json and adds each issue's status from GitHub.
 *
 * It only uses `gh api` (GitHub's REST API), so it also works in cloud
 * sessions, where `gh issue` and `gh pr` are blocked. Publishing the page is
 * the `roadmap` skill's job (.claude/skills/roadmap/SKILL.md).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs", "roadmap");

type MapIssue = { n: number; label: string };
type MapFeature = { name: string; about: string; issues: MapIssue[] };
type MapMilestone = {
  id: string;
  name: string;
  goal: string;
  doneWhen: string;
  /** The issue that holds a milestone's scope until it is grilled into ready issues. */
  epic?: number;
  sketch?: { name: string; about: string }[];
  features: MapFeature[];
};
type FeatureMap = { app: string; repo: string; milestones: MapMilestone[]; later: string[] };

type GhIssue = {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  labels: string[];
  isPr: boolean;
  closedAt: string | null;
  url: string;
};

/** done: closed. building: an open PR closes it. ready: every blocker closed. waiting: a blocker is still open. */
type Status = "done" | "building" | "ready" | "waiting";

const map: FeatureMap = JSON.parse(fs.readFileSync(path.join(dir, "features.json"), "utf8"));

function ghJsonLines(endpoint: string, jq: string): unknown[] {
  const out = execFileSync("gh", ["api", endpoint, "--paginate", "--jq", jq], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

const all = ghJsonLines(
  `repos/${map.repo}/issues?state=all&per_page=100`,
  ".[] | {number, title, state, body, labels: [.labels[].name], isPr: (.pull_request != null), closedAt: .closed_at, url: .html_url}",
) as GhIssue[];

const issues = new Map(all.filter((i) => !i.isPr).map((i) => [i.number, i]));

// GitHub milestones are titled "M1: …"; match them to the map by that id.
const ghMilestones = ghJsonLines(
  `repos/${map.repo}/milestones?state=all&per_page=100`,
  ".[] | {title, url: .html_url}",
) as { title: string; url: string }[];
const milestoneUrl = (id: string) => ghMilestones.find((m) => m.title.startsWith(`${id}:`))?.url ?? null;

// Issues an open PR will close ("Closes #N" in its body) are being built right now.
const building = new Set<number>();
for (const pr of all.filter((i) => i.isPr && i.state === "open")) {
  for (const m of (pr.body ?? "").matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)) {
    building.add(Number(m[1]));
  }
}

function blockers(issue: GhIssue): number[] {
  const line = (issue.body ?? "").match(/^Blocked by:(.*)$/im);
  return line ? [...line[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1])) : [];
}

/** An open issue is only ready once triage has labelled it for Claude or for the user. */
const triaged = (issue: GhIssue) => issue.labels.some((l) => l === "ready-for-agent" || l === "ready-for-human");

function status(issue: GhIssue): { status: Status; waitingOn: number[]; needsTriage: boolean } {
  if (issue.state === "closed") return { status: "done", waitingOn: [], needsTriage: false };
  if (building.has(issue.number)) return { status: "building", waitingOn: [], needsTriage: false };
  const waitingOn = blockers(issue).filter((n) => issues.get(n)?.state !== "closed");
  const needsTriage = !triaged(issue);
  return { status: waitingOn.length || needsTriage ? "waiting" : "ready", waitingOn, needsTriage };
}

const mapped = new Set<number>();

function count(list: { status: Status }[]) {
  return { done: list.filter((i) => i.status === "done").length, total: list.length };
}

const milestones = map.milestones.map((m) => {
  const features = m.features.map((f) => {
    const list = f.issues.map(({ n, label }) => {
      mapped.add(n);
      const gh = issues.get(n);
      if (!gh) throw new Error(`features.json lists #${n}, which isn't an issue on GitHub.`);
      return {
        n,
        label,
        title: gh.title,
        url: gh.url,
        mine: gh.labels.includes("ready-for-human"),
        closedAt: gh.closedAt,
        ...status(gh),
      };
    });
    return { name: f.name, about: f.about, counts: count(list), issues: list };
  });
  const flat = features.flatMap((f) => f.issues);
  const counts = count(flat);
  const state = flat.length === 0 ? "planned" : counts.done === counts.total ? "done" : "active";
  let epic = null;
  if (m.epic) {
    mapped.add(m.epic);
    const gh = issues.get(m.epic);
    if (!gh) throw new Error(`features.json names #${m.epic} as ${m.id}'s epic, which isn't an issue on GitHub.`);
    epic = { n: m.epic, title: gh.title, url: gh.url, state: gh.state };
  }
  return {
    id: m.id,
    name: m.name,
    goal: m.goal,
    doneWhen: m.doneWhen,
    url: milestoneUrl(m.id),
    epic,
    sketch: m.sketch ?? [],
    state,
    counts,
    features,
  };
});

const unmapped = [...issues.values()]
  .filter((i) => !mapped.has(i.number) && i.state === "open" && !i.labels.includes("epic"))
  .sort((a, b) => a.number - b.number)
  .map((i) => ({ n: i.number, title: i.title, url: i.url, mine: i.labels.includes("ready-for-human"), ...status(i) }));

const data = {
  app: map.app,
  repo: map.repo,
  generatedAt: new Date().toISOString(),
  milestones,
  unmapped,
  later: map.later,
};

fs.writeFileSync(path.join(dir, "roadmap.json"), JSON.stringify(data, null, 2) + "\n");

for (const m of milestones) {
  console.log(`${m.id}  ${m.state.padEnd(7)}  ${m.counts.done}/${m.counts.total}  ${m.name}`);
}
if (unmapped.length) {
  console.log(`Not on the map yet: ${unmapped.map((i) => `#${i.n}`).join(", ")}. Add them to docs/roadmap/features.json.`);
}
