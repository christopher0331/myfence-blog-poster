import { NextRequest, NextResponse } from "next/server";
import { generateBlogPost } from "@/lib/gemini";

/**
 * GET /api/test-gemini
 * Test endpoint to verify Gemini API is working
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // Test with a simple topic
    const result = await generateBlogPost({
      topic: "How to choose the right fence material",
      keywords: ["fence", "materials", "wood", "vinyl"],
      targetLength: 500, // Shorter for testing
    });

    return NextResponse.json({
      success: true,
      message: "Gemini API is working!",
      result: {
        title: result.title,
        contentLength: result.content.length,
        metaDescription: result.metaDescription,
        category: result.category,
        readTime: result.readTime,
      },
    });
  } catch (error: any) {
    console.error("Test Gemini error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to test Gemini API",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
