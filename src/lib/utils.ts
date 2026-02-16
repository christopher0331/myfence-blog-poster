import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * If body is or starts with a ```json { "content": "..." } block, extract the markdown.
 * Prevents raw Gemini JSON from being published as article body.
 * Handles truncated JSON (content string may run to end of file).
 */
function extractContentFromJsonBlock(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```") && !trimmed.startsWith('{"')) return null;
  const contentMatch = trimmed.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"?\s*[\s\S]*/);
  if (!contentMatch) return null;
  try {
    let inner = contentMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .trim();
    inner = inner.replace(/\s*```\s*$/, "").trim();
    return inner || null;
  } catch {
    return null;
  }
}

/**
 * Sanitize MDX body content so published articles match preview quality.
 * - If body is raw JSON with a "content" field, extract that markdown first.
 * - Strip leaked JSON/metadata lines (layout:, showArticleSummary:, etc.)
 * - Remove broken image lines (!Alt text without brackets/url)
 * - Remove leading # Title line (title is already in frontmatter, duplicating it looks bad)
 */
export function sanitizeMdxBody(content: string): string {
  if (!content || typeof content !== "string") return content;
  let body = content;
  const extracted = extractContentFromJsonBlock(body);
  if (extracted) body = extracted;

  // Strip a leading H1 title line — the title is rendered from frontmatter,
  // so having it again as the first line of the body creates a duplicate.
  body = body.replace(/^\s*#\s+[^\n]+\n*/, "");

  return body
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
