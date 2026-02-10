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

  // Determine which model to use
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = "gemini-2.5-flash";

  // Try these endpoints in order:
  // 1. GEMINI_MODEL (or gemini-2.5-flash) with v1beta API
  // 2. Same model with v1 API
  // 3. Falls back to gemini-2.5-flash with v1beta API
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`,
  ];

  let lastError: Error | null = null;
  let response: Response | null = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`[Gemini] Trying endpoint: ${endpoint.split('?')[0]}`);
      response = await fetch(endpoint, {
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
      });

      if (response.ok) {
        console.log(`[Gemini] Successfully connected to: ${endpoint.split('?')[0]}`);
        break; // Success, exit the loop
      }

      // If not OK, try to get error message
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
        console.error(`[Gemini] API error from ${endpoint.split('?')[0]}:`, errorData);
      } catch (parseError) {
        const text = await response.text().catch(() => "");
        errorMessage = text || errorMessage;
      }
      lastError = new Error(`Gemini API error: ${errorMessage}`);
    } catch (fetchError: any) {
      console.error(`[Gemini] Fetch error for ${endpoint.split('?')[0]}:`, fetchError);
      lastError = new Error(`Failed to fetch: ${fetchError.message}`);
      continue; // Try next endpoint
    }
  }

  // If all endpoints failed, throw the last error
  if (!response || !response.ok) {
    throw lastError || new Error("All Gemini API endpoints failed");
  }

  try {
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
