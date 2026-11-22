import Image from "next/image";
import type { ReactNode } from "react";
import { mediaUrl } from "@/content/media-url";
import { ui } from "@/ui-it";

/** A wide 16:9 frame for a content image (the scene poster, a step image), with optional overlays. */
export function MediaFrame({
  src,
  alt,
  fit = "cover",
  children,
}: {
  /** A content media path, e.g. `images/a2/u01/l01/poster.webp`. */
  src: string;
  alt: string;
  fit?: "cover" | "contain";
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
      />
      {children}
    </div>
  );
}

/** An item's image, left of its text or under its prompt (SPEC §5.2.1, §5.2.6); nothing when it has none. */
export function ItemImage({ src }: { src?: string }) {
  return src ? <MediaFrame src={src} alt={ui.lesson.itemImageAlt} fit="contain" /> : null;
}
