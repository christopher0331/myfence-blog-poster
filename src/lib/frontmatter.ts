import { sanitizeMdxBody } from "@/lib/utils";

interface FrontmatterInput {
  title: string;
  slug: string;
  meta_description?: string | null;
  category?: string | null;
  featured_image?: string | null;
  read_time?: string | null;
  keywords?: string | null;
  structured_data?: Record<string, unknown> | null;
}

function esc(val: string): string {
  return val.replace(/"/g, '\\"');
}

/**
 * Build YAML frontmatter + sanitized body for a blog MDX file.
 * Single source of truth used by manual publish, scheduled publish, and cron.
 */
export function buildMdxFile(input: FrontmatterInput, bodyMdx: string): string {
  const today = new Date().toISOString().split("T")[0];
  const publishDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    "---",
    `title: "${esc(input.title)}"`,
    `description: "${esc(input.meta_description || "")}"`,
    `slug: "${input.slug}"`,
    `category: "${input.category || ""}"`,
  ];

  if (input.featured_image) {
    lines.push(`image: "${esc(input.featured_image)}"`);
  }

  lines.push(
    `readTime: "${input.read_time || "5 min read"}"`,
    `publishDate: "${publishDate}"`,
    `datePublished: "${today}"`,
    `dateModified: "${today}"`,
  );

  if (input.keywords) {
    lines.push(`keywords: "${esc(input.keywords)}"`);
  }

  const sd = (input.structured_data || {}) as Record<string, unknown>;
  if (sd.layout) lines.push(`layout: "${sd.layout}"`);
  if (sd.showArticleSummary !== undefined)
    lines.push(`showArticleSummary: ${sd.showArticleSummary}`);

  lines.push("---");

  const body = sanitizeMdxBody(bodyMdx);
  return `${lines.join("\n")}\n\n${body}`;
}
