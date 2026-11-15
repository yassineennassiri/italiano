import { readFile } from "node:fs/promises";
import { mediaFile } from "@/content/media";

/** Content media (images, later audio) from `content/media`, which is not a public folder. */
export async function GET(_request: Request, ctx: RouteContext<"/media/[...path]">) {
  const media = mediaFile((await ctx.params).path);
  if (!media) return new Response(null, { status: 404 });
  return new Response(await readFile(media.file), {
    headers: { "Content-Type": media.contentType, "Cache-Control": "no-cache" },
  });
}
