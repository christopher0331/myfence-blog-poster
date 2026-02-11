import { NextResponse } from "next/server";
import { suggestTopicIdeas } from "@/lib/gemini";

export async function POST() {
  try {
    const ideas = await suggestTopicIdeas();
    return NextResponse.json({ ideas });
  } catch (error: any) {
    console.error("Suggest ideas error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to suggest topics" },
      { status: 500 }
    );
  }
}
