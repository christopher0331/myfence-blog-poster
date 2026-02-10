/**
 * Google Gemini API integration for writing blog posts
 */

interface GeminiBlogRequest {
  topic: string;
  keywords: string[];
  researchNotes?: string;
  targetLength?: number; // Target word count
}

interface GeminiBlogResponse {
  title: string;
  content: string; // MDX content
  metaDescription: string;
  category?: string;
  readTime?: string;
}

/**
 * Generates a blog post using Google Gemini API
 */
export async function generateBlogPost({
  topic,
  keywords,
  researchNotes,
  targetLength = 1500,
}: GeminiBlogRequest): Promise<GeminiBlogResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  // Build the prompt for Gemini
  const keywordsList = keywords.length > 0 ? keywords.join(", ") : "general fencing topics";
  const researchContext = researchNotes
    ? `\n\nAdditional research context:\n${researchNotes}`
    : "";

  const prompt = `You are an expert blog writer specializing in fence installation, maintenance, and related topics for homeowners and contractors.

Write a comprehensive, SEO-optimized blog post about: ${topic}

Keywords to focus on: ${keywordsList}${researchContext}

Requirements:
- Write in Markdown/MDX format
- Target approximately ${targetLength} words
- Include a compelling title
- Write engaging, informative content with proper headings (##, ###)
- Include practical tips and actionable advice
- Use a friendly, professional tone
- Include a meta description (120-160 characters) for SEO
- Suggest a relevant category (e.g., "Pricing", "Materials", "Legal", "Maintenance", "Installation", "DIY", "Design")
- Estimate read time (e.g., "5 min read")

Format your response as JSON with the following structure:
{
  "title": "Blog post title",
  "content": "Full MDX content with markdown formatting",
  "metaDescription": "SEO meta description",
  "category": "Suggested category",
  "readTime": "X min read"
}

Start writing now:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
        console.error("Gemini API error response:", errorData);
      } catch (parseError) {
        const text = await response.text().catch(() => "");
        errorMessage = text || errorMessage;
        console.error("Failed to parse Gemini error:", text);
      }
      throw new Error(`Gemini API error: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid response from Gemini API");
    }

    const generatedText = data.candidates[0].content.parts[0].text;

    // Try to parse JSON from the response
    // Gemini might wrap JSON in markdown code blocks
    let jsonText = generatedText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const parsed = JSON.parse(jsonText);
      return {
        title: parsed.title || topic,
        content: parsed.content || generatedText,
        metaDescription: parsed.metaDescription || `Learn about ${topic.toLowerCase()}`,
        category: parsed.category,
        readTime: parsed.readTime || "5 min read",
      };
    } catch (parseError) {
      // If JSON parsing fails, extract title and use full text as content
      const lines = generatedText.split("\n");
      const titleMatch = generatedText.match(/title["\s:]+"([^"]+)"/i) || 
                        generatedText.match(/#\s+(.+)/);
      const title = titleMatch ? titleMatch[1] : topic;

      return {
        title,
        content: generatedText,
        metaDescription: `Learn about ${topic.toLowerCase()}`,
        readTime: "5 min read",
      };
    }
  } catch (error: any) {
    console.error("Gemini API error:", error);
    throw new Error(`Failed to generate blog post: ${error.message}`);
  }
}
