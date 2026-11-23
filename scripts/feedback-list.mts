/**
 * `npm run feedback:list`: prints the open feedback notes as Markdown (SPEC
 * §10.6), so a content-fixing agent can read them. Read-only. Main branch
 * (DATABASE_URL), or the dev branch with `npm run feedback:list -- --test`.
 */
import { connect } from "../src/db/connect";
import { branchFromArgs, databaseUrl, loadLocalEnv } from "../src/db/env";
import { PROFILE_ID } from "../src/db/schema";
import { feedbackMarkdown } from "../src/feedback/notes";
import { loadOpenNoteGroups } from "../src/feedback/store";

loadLocalEnv();
const db = connect(databaseUrl(branchFromArgs(process.argv)));
process.stdout.write(feedbackMarkdown(await loadOpenNoteGroups(db, PROFILE_ID)));
