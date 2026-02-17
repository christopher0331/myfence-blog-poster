import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ai-edit
 *
 * Takes the current article content and an instruction, returns the edited content.
 * Uses Gemini to apply the edit.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set" },
      { status: 500 }
    );
  }

  try {
    const { instruction, bodyMdx, title, metaDescription } =
      await request.json();

    if (!instruction?.trim()) {
      return NextResponse.json(
        { error: "Instruction is required" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert blog editor for a fencing company in the Seattle/Pacific Northwest area. You will receive an existing blog article and an editing instruction. Apply the instruction precisely and return ONLY the edited article body in markdown. Do not include frontmatter, do not wrap in code blocks, do not add explanations before or after.

ARTICLE TITLE: ${title || "Untitled"}

ARTICLE META DESCRIPTION: ${metaDescription || "None"}

CURRENT ARTICLE BODY (markdown):
---
${bodyMdx || ""}
---

EDITING INSTRUCTION: ${instruction}

RULES:
- Apply ONLY the requested edit. Do not rewrite the entire article unless asked to.
- Preserve the existing markdown formatting style (headings, lists, callouts, tables, bold text).
- Keep the same tone and writing style.
- If the instruction asks to add a new section, place it in a logical location.
- If the instruction asks to shorten or remove content, do so cleanly.
- If the instruction asks about the article (a question rather than an edit), respond with just a brief answer prefixed with "NOTE: " — do not modify the article in that case.
- Return ONLY the full edited article body in markdown. No wrapping, no explanation.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Check if Gemini returned a NOTE (question response) instead of an edit
    if (text.trim().startsWith("NOTE:")) {
      return NextResponse.json({
        type: "note",
        message: text.trim().replace(/^NOTE:\s*/, ""),
      });
    }

    // Strip any accidental code fences Gemini might wrap with
    let cleaned = text.trim();
    if (cleaned.startsWith("```markdown")) {
      cleaned = cleaned.replace(/^```markdown\s*\n?/, "").replace(/\n?```\s*$/, "");
    } else if (cleaned.startsWith("```mdx")) {
      cleaned = cleaned.replace(/^```mdx\s*\n?/, "").replace(/\n?```\s*$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    return NextResponse.json({
      type: "edit",
      content: cleaned,
    });
  } catch (error: any) {
    console.error("[AI Edit] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process AI edit" },
      { status: 500 }
    );
  }
}
