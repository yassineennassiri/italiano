import Image from "next/image";
import type { ReactNode } from "react";
import { mediaUrl } from "@/content/media-url";

/** A wide 16:9 frame for a content image (the scene poster, a step image), with optional overlays. */
export function MediaFrame({
  src,
  alt,
  fit = "cover",
  priority = false,
  children,
}: {
  /** A content media path, e.g. `images/a2/u01/l01/poster.webp`. */
  src: string;
  alt: string;
  fit?: "cover" | "contain";
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-tint">
      <Image
        src={mediaUrl(src)}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 960px, 100vw"
        className={fit === "cover" ? "object-cover" : "object-contain"}
        priority={priority}
      />
      {children}
    </div>
  );
}
