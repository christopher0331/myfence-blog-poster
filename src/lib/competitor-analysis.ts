import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────

export interface SemrushRow {
  url: string;
  slug: string;
  traffic: number;
  keywords: number;
  infoTraffic: number;
  commercialTraffic: number;
  trafficChange: number;
  trafficPct: number;
}

export interface AnalysisOpportunity {
  competitorUrl: string;
  competitorSlug: string;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedKeywords: string[];
  estimatedTraffic: number;
  infoTraffic: number;
  competitorKeywordCount: number;
  trafficTrend: "growing" | "stable" | "declining";
  priority: "high" | "medium" | "low";
  alreadyCovered: boolean;
  existingSlug?: string;
}

export interface AnalysisResult {
  competitor: string;
  totalPages: number;
  contentPages: number;
  opportunities: AnalysisOpportunity[];
  alreadyCovered: number;
  gaps: number;
}

// ── CSV Parsing ────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const BASE_NON_CONTENT_PATTERNS = [
  /^https?:\/\/[^/]+\/?(\?.*)?$/,
  /\/(reviews|contact|about|careers|faq|privacy|terms|warranty|financing|projects|instant-estimate)\/?$/i,
  /\/category\//i,
  /\/blog\/?\d*\/?$/i,
  /\/page\/\d+/i,
  /\?utm_/i,
  /\/(residential|commercial).*landing\/?$/i,
  /-fence-company\/?$/i,
  /-fence-experts\/?$/i,
];

function buildLocationPattern(location?: string): RegExp | null {
  if (!location) return null;
  const tokens = location
    .toLowerCase()
    .replace(/[^a-z0-9\s/,-]/g, " ")
    .split(/[\s/,-]+/)
    .filter((t) => t.length > 3)
    .slice(0, 4);
  if (tokens.length === 0) return null;
  return new RegExp(`/(${tokens.join("|")})/?(\\?.*)?$`, "i");
}

function isContentPage(url: string, location?: string): boolean {
  const locationPattern = buildLocationPattern(location);
  const patterns = locationPattern
    ? [...BASE_NON_CONTENT_PATTERNS, locationPattern]
    : BASE_NON_CONTENT_PATTERNS;
  return !patterns.some((p) => p.test(url));
}

function extractSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.replace(/^\/|\/$/g, "");
  } catch {
    return url.replace(/^https?:\/\/[^/]+\/?/, "").replace(/\/$/, "");
  }
}

export function parseSemrushCSV(csvText: string): SemrushRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const urlIdx = headers.indexOf("url");
  const trafficIdx = headers.indexOf("traffic");
  const keywordsIdx = headers.indexOf("number of keywords");
  const infoIdx = headers.indexOf("traffic with informational intents in top 20");
  const commercialIdx = headers.indexOf("traffic with commercial intents in top 20");
  const changeIdx = headers.indexOf("traffic change");
  const pctIdx = headers.indexOf("traffic (%)");

  if (urlIdx === -1 || trafficIdx === -1) {
    throw new Error("CSV missing required columns: URL and Traffic");
  }

  const rows: SemrushRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[urlIdx]) continue;

    rows.push({
      url: cols[urlIdx],
      slug: extractSlug(cols[urlIdx]),
      traffic: parseInt(cols[trafficIdx] || "0", 10) || 0,
      keywords: parseInt(cols[keywordsIdx] || "0", 10) || 0,
      infoTraffic: parseInt(cols[infoIdx] || "0", 10) || 0,
      commercialTraffic: parseInt(cols[commercialIdx] || "0", 10) || 0,
      trafficChange: parseInt(cols[changeIdx] || "0", 10) || 0,
      trafficPct: parseFloat(cols[pctIdx] || "0") || 0,
    });
  }

  return rows;
}

export function filterContentPages(rows: SemrushRow[], location?: string): SemrushRow[] {
  return rows
    .filter((r) => isContentPage(r.url, location))
    .filter((r) => r.traffic > 0 || r.keywords > 5)
    .sort((a, b) => b.traffic - a.traffic);
}

// ── Slug-to-title conversion ────────────────────────────────────────────

function slugToTitle(slug: string): string {
  const lastSegment = slug.split("/").pop() || slug;
  return lastSegment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function extractKeywordsFromSlug(slug: string): string[] {
  const lastSegment = slug.split("/").pop() || slug;
  return lastSegment
    .split(/[-_]/)
    .filter((w) => w.length > 2)
    .slice(0, 6);
}

// ── Cross-reference with existing blog ─────────────────────────────────

interface ExistingPost {
  slug: string;
  title: string;
}

async function getExistingPosts(siteId: string): Promise<ExistingPost[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from("blog_drafts")
    .select("slug, title, status")
    .eq("site_id", siteId)
    .in("status", ["draft", "review", "scheduled", "published"]);

  return (data || []).map((d: any) => ({
    slug: d.slug as string,
    title: (d.title as string) || "",
  }));
}

function normalizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function findMatchingPost(
  competitorSlug: string,
  existingPosts: ExistingPost[],
): ExistingPost | null {
  const compWords = normalizeForMatch(competitorSlug);
  if (compWords.length === 0) return null;

  let bestMatch: ExistingPost | null = null;
  let bestScore = 0;

  for (const post of existingPosts) {
    const postWords = [
      ...normalizeForMatch(post.slug),
      ...normalizeForMatch(post.title),
    ];
    const overlap = compWords.filter((w) => postWords.includes(w)).length;
    const score = overlap / Math.max(compWords.length, 1);

    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = post;
    }
  }

  return bestMatch;
}

// ── Fast analysis (no AI) ───────────────────────────────────────────────

export async function analyzeCompetitorContent(
  csvText: string,
  siteId: string,
  location?: string,
): Promise<AnalysisResult> {
  const allRows = parseSemrushCSV(csvText);
  const contentRows = filterContentPages(allRows, location);
  const existingPosts = await getExistingPosts(siteId);

  const competitor = allRows[0]?.url
    ? new URL(allRows[0].url).hostname
    : "unknown";

  const opportunities: AnalysisOpportunity[] = contentRows
    .slice(0, 50)
    .map((row) => {
      const match = findMatchingPost(row.slug, existingPosts);
      const trend: AnalysisOpportunity["trafficTrend"] =
        row.trafficChange > 50
          ? "growing"
          : row.trafficChange < -50
            ? "declining"
            : "stable";
      const priority: AnalysisOpportunity["priority"] =
        row.traffic > 200 || row.keywords > 100
          ? "high"
          : row.traffic > 50
            ? "medium"
            : "low";

      return {
        competitorUrl: row.url,
        competitorSlug: row.slug,
        suggestedTitle: slugToTitle(row.slug),
        suggestedDescription: `Competitor page with ${row.traffic} estimated monthly traffic and ${row.keywords} ranking keywords.`,
        suggestedKeywords: extractKeywordsFromSlug(row.slug),
        estimatedTraffic: row.traffic,
        infoTraffic: row.infoTraffic,
        competitorKeywordCount: row.keywords,
        trafficTrend: trend,
        priority,
        alreadyCovered: !!match,
        existingSlug: match?.slug,
      };
    });

  opportunities.sort((a, b) => {
    if (a.alreadyCovered !== b.alreadyCovered)
      return a.alreadyCovered ? 1 : -1;
    return b.estimatedTraffic - a.estimatedTraffic;
  });

  return {
    competitor,
    totalPages: allRows.length,
    contentPages: contentRows.length,
    opportunities,
    alreadyCovered: opportunities.filter((o) => o.alreadyCovered).length,
    gaps: opportunities.filter((o) => !o.alreadyCovered).length,
  };
}
