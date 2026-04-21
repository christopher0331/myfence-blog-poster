import type { SiteConfig } from "@/lib/types";
import { getAdminClient } from "@/lib/supabase-admin";
import { getSites } from "@/lib/get-site";
import { nextSlot } from "@/lib/scheduling";
import { generateBlogPost } from "@/lib/gemini";
import { commitBlogDirectly } from "@/lib/github";
import { sanitizeMdxBody } from "@/lib/utils";

// ---------- Tool schemas (Gemini function declarations) ----------

export const TOOL_DECLARATIONS = [
  {
    name: "list_sites",
    description:
      "List all configured sites/brands managed by the CMS, including their current auto-publishing cadence.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_site_settings",
    description:
      "Fetch full configuration for one site by domain or name.",
    parameters: {
      type: "object",
      properties: {
        site: {
          type: "string",
          description: "Site domain or name (e.g. 'myfence.com' or 'MyFence').",
        },
      },
      required: ["site"],
    },
  },
  {
    name: "update_site_schedule",
    description:
      "Update auto-publishing cadence for a site: toggle enabled, posts/week, posting days (0=Sun..6=Sat), or hour (UTC).",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site domain or name." },
        enabled: { type: "boolean" },
        postsPerWeek: { type: "number" },
        days: {
          type: "array",
          items: { type: "number" },
          description: "Weekday numbers 0=Sun..6=Sat.",
        },
        hourUtc: { type: "number", description: "Publish hour in UTC (0-23)." },
      },
      required: ["site"],
    },
  },
  {
    name: "list_topics",
    description: "List blog topics for a site, optionally filtered by status.",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string" },
        status: {
          type: "string",
          enum: ["preparing", "ready", "in_progress", "completed"],
        },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "create_topic",
    description:
      "Create a new blog topic. Use status 'ready' if the user wants the cron/agent to write it soon, otherwise 'preparing'.",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        priority: {
          type: "number",
          description: "1 (low) to 10 (high).",
        },
        status: {
          type: "string",
          enum: ["preparing", "ready"],
        },
        researchNotes: { type: "string" },
      },
      required: ["site", "title"],
    },
  },
  {
    name: "delete_topic",
    description: "Delete a topic by id.",
    parameters: {
      type: "object",
      properties: { topicId: { type: "string" } },
      required: ["topicId"],
    },
  },
  {
    name: "list_drafts",
    description:
      "List blog drafts, filtered by site and/or status (draft|scheduled|review|published).",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string" },
        status: {
          type: "string",
          enum: ["draft", "scheduled", "review", "published"],
        },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "write_blog",
    description:
      "Generate a full blog post with Gemini for a site and save it as a draft. If a matching topic exists it will be reused; otherwise a topic is created automatically. Does NOT publish.",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string" },
        title: {
          type: "string",
          description: "Topic / blog title, e.g. 'Picture Frame Fences in Maple Valley'.",
        },
        instructions: {
          type: "string",
          description:
            "Free-form extra context for the writer (audience, angle, must-include points, local details).",
        },
        keywords: { type: "array", items: { type: "string" } },
        targetLength: { type: "number", description: "Target word count. Default 1500." },
      },
      required: ["site", "title"],
    },
  },
  {
    name: "schedule_draft",
    description:
      "Schedule an existing draft for future publishing. If `when` is omitted or 'next_slot', uses the next open slot for the draft's site.",
    parameters: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        when: {
          type: "string",
          description:
            "Either 'next_slot' or an ISO 8601 timestamp (e.g. 2026-04-24T16:00:00Z).",
        },
      },
      required: ["draftId"],
    },
  },
  {
    name: "publish_draft",
    description:
      "Publish a draft immediately — commits the MDX file to the site's GitHub repo.",
    parameters: {
      type: "object",
      properties: { draftId: { type: "string" } },
      required: ["draftId"],
    },
  },
  {
    name: "delete_draft",
    description: "Delete a draft by id.",
    parameters: {
      type: "object",
      properties: { draftId: { type: "string" } },
      required: ["draftId"],
    },
  },
  {
    name: "move_draft",
    description:
      "Move (reassign) an existing draft to a different site without re-generating its content. Use this when the user says 'move this post to X site'.",
    parameters: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        targetSite: {
          type: "string",
          description: "Domain or name of the destination site.",
        },
      },
      required: ["draftId", "targetSite"],
    },
  },
  {
    name: "copy_draft",
    description:
      "Duplicate an existing draft to a different site (or same site) without re-generating. Original is kept.",
    parameters: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        targetSite: {
          type: "string",
          description: "Domain or name of the destination site.",
        },
      },
      required: ["draftId", "targetSite"],
    },
  },
] as const;

// ---------- Helpers ----------

function matchSite(sites: SiteConfig[], query: string | undefined): SiteConfig | null {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  return (
    sites.find((s) => s.domain.toLowerCase() === q) ||
    sites.find((s) => s.name.toLowerCase() === q) ||
    sites.find((s) => s.domain.toLowerCase().includes(q)) ||
    sites.find((s) => s.name.toLowerCase().includes(q)) ||
    null
  );
}

async function resolveSite(
  arg: string | undefined,
  fallback: SiteConfig,
): Promise<SiteConfig> {
  if (!arg) return fallback;
  const sites = await getSites();
  return matchSite(sites, arg) || fallback;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- Tool runner ----------

export interface ToolContext {
  activeSite: SiteConfig;
}

export async function runTool(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext,
): Promise<Record<string, any>> {
  const supabase = getAdminClient();

  switch (name) {
    // ---------- sites ----------
    case "list_sites": {
      const sites = await getSites();
      return {
        sites: sites.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          auto_publish_enabled: s.auto_publish_enabled,
          posts_per_week: s.posts_per_week,
          posting_days: s.posting_days,
          posting_hour_utc: s.posting_hour_utc,
        })),
      };
    }

    case "get_site_settings": {
      const site = await resolveSite(args.site, ctx.activeSite);
      return { site };
    }

    case "update_site_schedule": {
      const site = await resolveSite(args.site, ctx.activeSite);
      const patch: Record<string, unknown> = {};
      if (typeof args.enabled === "boolean") patch.auto_publish_enabled = args.enabled;
      if (typeof args.postsPerWeek === "number") patch.posts_per_week = args.postsPerWeek;
      if (Array.isArray(args.days)) patch.posting_days = args.days;
      if (typeof args.hourUtc === "number") patch.posting_hour_utc = args.hourUtc;
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: "No schedule fields provided" };
      }
      const { data, error } = await supabase
        .from("sites")
        .update(patch)
        .eq("id", site.id)
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, site: data };
    }

    // ---------- topics ----------
    case "list_topics": {
      const site = await resolveSite(args.site, ctx.activeSite);
      let q = supabase
        .from("blog_topics")
        .select("id, title, status, priority, description, keywords, created_at")
        .eq("site_id", site.id)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(args.limit) || 20, 100));
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, site: site.domain, topics: data || [] };
    }

    case "create_topic": {
      const site = await resolveSite(args.site, ctx.activeSite);
      const { data, error } = await supabase
        .from("blog_topics")
        .insert({
          site_id: site.id,
          title: String(args.title).trim(),
          description: args.description || null,
          keywords: Array.isArray(args.keywords) ? args.keywords : [],
          research_notes: args.researchNotes || null,
          priority: typeof args.priority === "number" ? args.priority : 5,
          status: args.status || "preparing",
          source: "ai",
        })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, topic: data };
    }

    case "delete_topic": {
      const { error } = await supabase
        .from("blog_topics")
        .delete()
        .eq("id", args.topicId);
      if (error) return { ok: false, error: error.message };
      return { ok: true, deleted: args.topicId };
    }

    // ---------- drafts ----------
    case "list_drafts": {
      const site = await resolveSite(args.site, ctx.activeSite);
      let q = supabase
        .from("blog_drafts")
        .select(
          "id, title, slug, status, scheduled_publish_at, published_at, updated_at, meta_description",
        )
        .eq("site_id", site.id)
        .order("updated_at", { ascending: false })
        .limit(Math.min(Number(args.limit) || 20, 100));
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, site: site.domain, drafts: data || [] };
    }

    case "write_blog": {
      const site = await resolveSite(args.site, ctx.activeSite);
      const title: string = String(args.title || "").trim();
      if (!title) return { ok: false, error: "title is required" };

      // Find or create topic
      const { data: existingTopic } = await supabase
        .from("blog_topics")
        .select("id, title, description, keywords, research_notes, topic_images")
        .eq("site_id", site.id)
        .ilike("title", title)
        .maybeSingle();

      let topicId: string;
      let topicData: any = existingTopic;
      if (!existingTopic) {
        const { data: newTopic, error: topicErr } = await supabase
          .from("blog_topics")
          .insert({
            site_id: site.id,
            title,
            description: args.instructions || null,
            keywords: Array.isArray(args.keywords) ? args.keywords : [],
            research_notes: args.instructions || null,
            status: "in_progress",
            source: "ai",
            priority: 7,
          })
          .select()
          .single();
        if (topicErr || !newTopic) {
          return { ok: false, error: topicErr?.message || "topic creation failed" };
        }
        topicId = newTopic.id;
        topicData = newTopic;
      } else {
        topicId = existingTopic.id;
        await supabase
          .from("blog_topics")
          .update({ status: "in_progress" })
          .eq("id", topicId);
      }

      // Generate
      let post;
      try {
        post = await generateBlogPost({
          topic: title,
          keywords: topicData?.keywords || args.keywords || [],
          researchNotes:
            topicData?.research_notes || args.instructions || undefined,
          topicDescription:
            topicData?.description || args.instructions || undefined,
          topicImages: Array.isArray(topicData?.topic_images)
            ? topicData.topic_images
            : undefined,
          targetLength: Number(args.targetLength) || 1500,
          site,
        });
      } catch (err: any) {
        await supabase
          .from("blog_topics")
          .update({ status: "ready" })
          .eq("id", topicId);
        return { ok: false, error: `Gemini failed: ${err.message}` };
      }

      const slug = slugify(post.title);
      const { data: draft, error: draftErr } = await supabase
        .from("blog_drafts")
        .insert({
          site_id: site.id,
          topic_id: topicId,
          title: post.title,
          slug,
          body_mdx: sanitizeMdxBody(post.content),
          meta_description: post.metaDescription,
          category: post.category || "",
          read_time: post.readTime || "5 min read",
          featured_image: (post as any).featuredImage || null,
          structured_data: {
            imageCaption: (post as any).imageCaption,
            layout: (post as any).layout,
            showArticleSummary: (post as any).showArticleSummary,
          },
          status: "draft",
        })
        .select()
        .single();

      if (draftErr || !draft) {
        return { ok: false, error: draftErr?.message || "draft insert failed" };
      }

      return {
        ok: true,
        draftId: draft.id,
        title: draft.title,
        slug: draft.slug,
        site: site.domain,
      };
    }

    case "schedule_draft": {
      const { data: draft, error: draftErr } = await supabase
        .from("blog_drafts")
        .select("id, title, site_id, status")
        .eq("id", args.draftId)
        .single();
      if (draftErr || !draft) return { ok: false, error: "draft not found" };

      const sites = await getSites();
      const site = sites.find((s) => s.id === draft.site_id);
      if (!site) return { ok: false, error: "site not found for draft" };

      let iso: string;
      const when = args.when;
      if (!when || when === "next_slot") {
        iso = await nextSlot(site);
      } else {
        const d = new Date(when);
        if (isNaN(d.getTime())) return { ok: false, error: `invalid date: ${when}` };
        iso = d.toISOString();
      }

      const { data, error } = await supabase
        .from("blog_drafts")
        .update({ status: "scheduled", scheduled_publish_at: iso })
        .eq("id", draft.id)
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, draftId: draft.id, scheduled_publish_at: data?.scheduled_publish_at };
    }

    case "publish_draft": {
      const { data: draft, error: draftErr } = await supabase
        .from("blog_drafts")
        .select("*")
        .eq("id", args.draftId)
        .single();
      if (draftErr || !draft) return { ok: false, error: "draft not found" };

      const sites = await getSites();
      const site = sites.find((s) => s.id === draft.site_id);
      if (!site) return { ok: false, error: "site not found" };

      const today = new Date().toISOString().split("T")[0];
      const publishDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const frontmatterLines = [
        "---",
        `title: "${String(draft.title).replace(/"/g, '\\"')}"`,
        `description: "${String(draft.meta_description || "").replace(/"/g, '\\"')}"`,
        `slug: "${draft.slug}"`,
        `category: "${draft.category || ""}"`,
        `image: "${draft.featured_image || ""}"`,
        `readTime: "${draft.read_time || "5 min read"}"`,
        `publishDate: "${publishDate}"`,
        `datePublished: "${today}"`,
        `dateModified: "${today}"`,
      ];
      const mdx = `${frontmatterLines.join("\n")}\n---\n\n${sanitizeMdxBody(draft.body_mdx || "")}`;

      try {
        const { commitUrl } = await commitBlogDirectly({
          slug: draft.slug,
          mdxContent: mdx,
          title: draft.title,
          commitMessage: `Publish via agent: ${draft.title}`,
          site,
        });
        await supabase
          .from("blog_drafts")
          .update({
            github_pr_url: commitUrl,
            status: "published",
            published_at: new Date().toISOString(),
          })
          .eq("id", draft.id);
        if (draft.topic_id) {
          await supabase
            .from("blog_topics")
            .update({ status: "completed" })
            .eq("id", draft.topic_id);
        }
        return { ok: true, draftId: draft.id, commitUrl };
      } catch (err: any) {
        return { ok: false, error: `GitHub commit failed: ${err.message}` };
      }
    }

    case "delete_draft": {
      const { error } = await supabase
        .from("blog_drafts")
        .delete()
        .eq("id", args.draftId);
      if (error) return { ok: false, error: error.message };
      return { ok: true, deleted: args.draftId };
    }

    case "move_draft": {
      const sites = await getSites();
      const target = matchSite(sites, args.targetSite);
      if (!target) return { ok: false, error: `Site not found: ${args.targetSite}` };
      const { data, error } = await supabase
        .from("blog_drafts")
        .update({ site_id: target.id, topic_id: null })
        .eq("id", args.draftId)
        .select("id, title, slug, site_id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, draft: data, movedTo: target.domain };
    }

    case "copy_draft": {
      const sites = await getSites();
      const target = matchSite(sites, args.targetSite);
      if (!target) return { ok: false, error: `Site not found: ${args.targetSite}` };
      const { data: src, error: srcErr } = await supabase
        .from("blog_drafts")
        .select("*")
        .eq("id", args.draftId)
        .single();
      if (srcErr || !src) return { ok: false, error: "Draft not found" };
      // Ensure unique slug in target site
      const slug = `${src.slug}-copy`;
      const { data: copy, error: copyErr } = await supabase
        .from("blog_drafts")
        .insert({
          ...src,
          id: undefined,
          site_id: target.id,
          topic_id: null,
          slug,
          status: "draft",
          published_at: null,
          github_pr_url: null,
          scheduled_publish_at: null,
          created_at: undefined,
          updated_at: undefined,
        })
        .select("id, title, slug")
        .single();
      if (copyErr || !copy) return { ok: false, error: copyErr?.message || "copy failed" };
      return { ok: true, newDraftId: copy.id, slug: copy.slug, copiedTo: target.domain };
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
