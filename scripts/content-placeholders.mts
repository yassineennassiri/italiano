/** `npm run content:placeholders`: writes a placeholder for every referenced image that is missing. */
import path from "node:path";
import { generatePlaceholders } from "../src/content/placeholders";

const created = await generatePlaceholders(path.join(process.cwd(), "content"));
for (const file of created) console.log(`+ media/${file}`);
console.log(`content:placeholders: ${created.length} placeholder${created.length === 1 ? "" : "s"} written.`);
