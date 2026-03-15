import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitorContent } from "@/lib/competitor-analysis";
import { createClient } from "@supabase/supabase-js";
import type { TopicStatus } from "@/lib/types";
import { getSiteFromRequest } from "@/lib/get-site";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/competitor-analysis
 * Returns the most recent saved analysis, or null.
 */
export async function GET(req: NextRequest) {
  try {
    const site = await getSiteFromRequest(req);
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("competitor_analyses")
      .select("*")
      .eq("site_id", site.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: true, analysis: null });
    }

    return NextResponse.json({
      success: true,
      analysis: {
        id: data.id,
        competitor: data.competitor,
        totalPages: data.total_pages,
        contentPages: data.content_pages,
        opportunities: data.opportunities,
        alreadyCovered: data.already_covered,
        gaps: data.gaps,
        created_at: data.created_at,
      },
    });
  } catch (error: any) {
    console.error("[Competitor Analysis] GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load analysis" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/competitor-analysis
 * - analyze: parse CSV, save to DB, return results
 * - create-topics: bulk-create topics from selected opportunities
 * - update: update the saved analysis opportunities in DB
 */
export async function POST(req: NextRequest) {
  try {
    const site = await getSiteFromRequest(req);
    const body = await req.json();
    const { csvText, action, opportunities, analysisId } = body;

    if (action === "analyze" || (!action && csvText)) {
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json(
          { error: "csvText is required" },
          { status: 400 },
        );
      }

      const result = await analyzeCompetitorContent(csvText, site.id, site.location);

      const supabase = getAdminClient();
      const { data: saved, error: saveError } = await supabase
        .from("competitor_analyses")
        .insert({
          site_id: site.id,
          competitor: result.competitor,
          total_pages: result.totalPages,
          content_pages: result.contentPages,
          gaps: result.gaps,
          already_covered: result.alreadyCovered,
          opportunities: result.opportunities,
        })
        .select("id")
        .single();

      if (saveError) {
        console.error("[Competitor Analysis] Save error:", saveError);
      }

      return NextResponse.json({
        success: true,
        id: saved?.id || null,
        ...result,
      });
    }

    if (action === "create-topics") {
      if (!Array.isArray(opportunities) || opportunities.length === 0) {
        return NextResponse.json(
          { error: "opportunities array is required" },
          { status: 400 },
        );
      }

      const supabase = getAdminClient();
      const created: string[] = [];

      for (const opp of opportunities) {
        if (opp.alreadyCovered) continue;

        const { data: existing } = await supabase
          .from("blog_topics")
          .select("id")
          .eq("site_id", site.id)
          .ilike("title", `%${opp.suggestedTitle.slice(0, 30)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const status: TopicStatus =
          opp.priority === "high" ? "ready" : "preparing";

        const { data, error } = await supabase
          .from("blog_topics")
          .insert({
            site_id: site.id,
            title: opp.suggestedTitle,
            description: opp.suggestedDescription,
            keywords: opp.suggestedKeywords || [],
            research_notes: `Competitor gap from ${opp.competitorUrl}\nEstimated traffic: ${opp.estimatedTraffic}\nCompetitor keywords: ${opp.competitorKeywordCount}`,
            source: "ai" as const,
            status,
            priority:
              opp.priority === "high"
                ? 9
                : opp.priority === "medium"
                  ? 6
                  : 3,
          })
          .select("id")
          .single();

        if (!error && data) {
          created.push(data.id);
        }
      }

      return NextResponse.json({
        success: true,
        created: created.length,
        message: `Created ${created.length} new topics`,
      });
    }

    if (action === "update-opportunities") {
      if (!analysisId || !Array.isArray(opportunities)) {
        return NextResponse.json(
          { error: "analysisId and opportunities are required" },
          { status: 400 },
        );
      }

      const supabase = getAdminClient();
      const gapCount = opportunities.filter((o: any) => !o.alreadyCovered).length;
      const coveredCount = opportunities.filter((o: any) => o.alreadyCovered).length;

      const { error } = await supabase
        .from("competitor_analyses")
        .update({
          opportunities,
          gaps: gapCount,
          already_covered: coveredCount,
        })
        .eq("id", analysisId)
        .eq("site_id", site.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Competitor Analysis] Error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/competitor-analysis?id=...
 * Deletes a saved analysis.
 */
export async function DELETE(req: NextRequest) {
  try {
    const site = await getSiteFromRequest(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("competitor_analyses")
      .delete()
      .eq("id", id)
      .eq("site_id", site.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 },
    );
  }
}
