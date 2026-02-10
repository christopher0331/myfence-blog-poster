"use client";

import { useMemo } from "react";

interface MDXPreviewProps {
  content: string;
  title?: string;
  description?: string;
  category?: string;
}

/**
 * A simple client-side MDX preview that renders markdown-like content.
 * For full MDX rendering, the actual next-mdx-remote is used at publish time.
 * This provides a good-enough live preview while editing.
 */
export default function MDXPreview({ content, title, description, category }: MDXPreviewProps) {
  const html = useMemo(() => {
    // Simple markdown-to-HTML conversion for preview purposes
    let processed = content
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-primary hover:underline" href="$2">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="rounded-lg my-4 max-w-full" alt="$1" src="$2" />')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-muted-foreground">• $1</li>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-muted-foreground list-decimal">$1</li>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">$1</blockquote>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="my-6 border-border" />')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-muted rounded-lg p-4 my-4 text-sm overflow-x-auto"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p class="text-muted-foreground leading-relaxed mb-4 text-base">')
      // Single newlines (preserve within paragraphs)
      .replace(/\n/g, '<br />');

    return `<p class="text-muted-foreground leading-relaxed mb-4 text-base">${processed}</p>`;
  }, [content]);

  return (
    <div className="bg-background border rounded-lg overflow-hidden">
      {/* Preview Header */}
      <div className="bg-muted/30 px-4 py-2 border-b">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Preview
        </p>
      </div>

      {/* Blog Post Preview */}
      <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Mini hero preview */}
        {(title || category) && (
          <div className="mb-6 pb-6 border-b">
            {category && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {category}
              </span>
            )}
            {title && (
              <h1 className="text-2xl font-bold mt-3 mb-2">{title}</h1>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        {/* Content preview */}
        {content ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-muted-foreground/50 italic">
            Start writing in the editor to see a preview...
          </p>
        )}
      </div>
    </div>
  );
}
