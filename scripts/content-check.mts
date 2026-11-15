/** `npm run content:check`: validates everything under content/. Exits 1 on any problem. */
import path from "node:path";
import { checkContent } from "../src/content/check";

const contentDir = path.join(process.cwd(), "content");
const problems = checkContent(contentDir);

if (problems.length === 0) {
  console.log("content:check: all content is valid.");
} else {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`\ncontent:check: ${problems.length} problem${problems.length === 1 ? "" : "s"} found.`);
  process.exitCode = 1;
}
