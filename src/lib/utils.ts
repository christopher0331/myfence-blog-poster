import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize MDX body content so published articles match preview quality.
 * - Strip leaked JSON/metadata lines (layout:, showArticleSummary:, etc.)
 * - Remove broken image lines (!Alt text without brackets/url)
 */
export function sanitizeMdxBody(content: string): string {
  if (!content || typeof content !== "string") return content;
  return content
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(layout|showArticleSummary|imageCaption|featuredImage)\s*[:=]/.test(t)) return false;
      if (/^!\s*[^[\s]/.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
