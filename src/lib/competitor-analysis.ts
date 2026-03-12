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

/**
 * Pages that are NOT content/blog articles — filter these out.
 * Matches homepages, location/city pages, category index, contact, etc.
 */
const NON_CONTENT_PATTERNS = [
  /^https?:\/\/[^/]+\/?(\?.*)?$/,              // homepage (with or without query params)
  /\/(reviews|contact|about|careers|faq|privacy|terms|warranty|financing|projects|instant-estimate)\/?$/i,
  /\/category\//i,
  /\/blog\/?\d*\/?$/i,                          // /blog/ index or paginated /blog/4/
  /\/page\/\d+/i,
  /\?utm_/i,                                     // tracking-param variants of pages
  /\/(residential|commercial).*landing\/?$/i,
  /-fence-company\/?$/i,                         // location service pages
  /-fence-experts\/?$/i,                         // location service pages
  /\/(portland|seattle)\/?(\?.*)?$/i,            // city landing pages
];

function isContentPage(url: string): boolean {
  return !NON_CONTENT_PATTERNS.some((p) => p.test(url));
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

export function filterContentPages(rows: SemrushRow[]): SemrushRow[] {
  return rows
    .filter((r) => isContentPage(r.url))
    .filter((r) => r.traffic > 0 || r.keywords > 5)
    .sort((a, b) => b.traffic - a.traffic);
}

// ── Cross-reference with existing blog ─────────────────────────────────

async function getExistingSlugs(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from("blog_drafts")
    .select("slug, title, status")
    .in("status", ["draft", "review", "scheduled", "published"]);

  return (data || []).map((d: any) => d.slug as string);
}

// ── Gemini Analysis ────────────────────────────────────────────────────

export async function analyzeCompetitorContent(
  csvText: string,
): Promise<AnalysisResult> {
  const allRows = parseSemrushCSV(csvText);
  const contentRows = filterContentPages(allRows);
  const existingSlugs = await getExistingSlugs();

  const competitor = allRows[0]?.url
    ? new URL(allRows[0].url).hostname
    : "unknown";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Build a compact representation for Gemini
  const competitorSummary = contentRows.slice(0, 40).map((r) => ({
    url: r.url,
    slug: r.slug,
    traffic: r.traffic,
    keywords: r.keywords,
    infoTraffic: r.infoTraffic,
    trend: r.trafficChange > 50 ? "growing" : r.trafficChange < -50 ? "declining" : "stable",
  }));

  const prompt = `You are an SEO content strategist for MyFence.com, a fence company blog targeting Seattle/Pacific Northwest homeowners.

COMPETITOR DATA (from SEMrush for ${competitor}):
${JSON.stringify(competitorSummary, null, 2)}

OUR EXISTING BLOG SLUGS (myfence.com/blog/...):
${JSON.stringify(existingSlugs)}

TASK:
Analyze each competitor content page and determine:
1. Whether we already have an equivalent article (match by topic, not exact slug)
2. For gaps (topics we DON'T cover): suggest a title, description, and keywords we should write about
3. Prioritize by traffic opportunity — high traffic + informational intent = high priority

For each competitor page, return a JSON object. Focus on the TOP opportunities we should write FIRST.

IMPORTANT RULES:
- Skip location/city service pages, review pages, and non-article content
- For pages we already cover, set alreadyCovered: true and include our matching slug
- For gaps, suggest titles localized to Seattle/PNW (not Houston/Texas/San Antonio)
- Priority: "high" = traffic > 200 or keywords > 100, "medium" = traffic > 50, "low" = rest
- suggestedKeywords should be 3-6 SEO keywords relevant to the topic

Return ONLY valid JSON array, no markdown fences:
[
  {
    "competitorUrl": "...",
    "competitorSlug": "...",
    "suggestedTitle": "...",
    "suggestedDescription": "2-3 sentence article scope",
    "suggestedKeywords": ["kw1", "kw2"],
    "estimatedTraffic": 123,
    "infoTraffic": 100,
    "competitorKeywordCount": 50,
    "trafficTrend": "growing|stable|declining",
    "priority": "high|medium|low",
    "alreadyCovered": false,
    "existingSlug": null
  }
]`;

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  let jsonText = text.trim().replace(/^```json?\n?/i, "").replace(/\n?```\s*$/, "").trim();
  const firstBracket = jsonText.indexOf("[");
  const lastBracket = jsonText.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    jsonText = jsonText.slice(firstBracket, lastBracket + 1);
  }

  let opportunities: AnalysisOpportunity[];
  try {
    opportunities = JSON.parse(jsonText);
  } catch {
    throw new Error("Failed to parse Gemini analysis response");
  }

  // Sort: uncovered first, then by traffic descending
  opportunities.sort((a, b) => {
    if (a.alreadyCovered !== b.alreadyCovered) return a.alreadyCovered ? 1 : -1;
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
