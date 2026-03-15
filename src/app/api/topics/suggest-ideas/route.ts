import { NextRequest, NextResponse } from "next/server";
import { suggestTopicIdeas } from "@/lib/gemini";
import { getSiteFromRequest } from "@/lib/get-site";

export async function POST(req: NextRequest) {
  try {
    const site = await getSiteFromRequest(req);
    const ideas = await suggestTopicIdeas(site);
    return NextResponse.json({ ideas });
  } catch (error: any) {
    console.error("Suggest ideas error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to suggest topics" },
      { status: 500 }
    );
  }
}
