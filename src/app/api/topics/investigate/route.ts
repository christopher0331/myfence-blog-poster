import { NextRequest, NextResponse } from "next/server";
import { investigateTopic } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json();
    if (!idea || typeof idea !== "string" || !idea.trim()) {
      return NextResponse.json({ error: "idea is required" }, { status: 400 });
    }
    const result = await investigateTopic(idea.trim());
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Investigate topic error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to research topic" },
      { status: 500 }
    );
  }
}
