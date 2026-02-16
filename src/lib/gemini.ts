/**
 * Google Gemini API integration for writing blog posts
 */

interface TopicImageInput {
  url: string;
  description: string;
}

interface GeminiBlogRequest {
  topic: string;
  keywords: string[];
  researchNotes?: string;
  topicDescription?: string;
  topicImages?: TopicImageInput[];
  targetLength?: number; // Target word count
}

interface GeminiBlogResponse {
  title: string;
  content: string; // MDX content
  metaDescription: string;
  category?: string;
  readTime?: string;
  featuredImage?: string; // URL or path for hero image
  imageCaption?: string; // e.g. "Image courtesy of Barrier Boss USA"
  layout?: "centered" | "two-column";
  showArticleSummary?: boolean;
}

/**
 * Generates a blog post using Google Gemini API
 */
export async function generateBlogPost({
  topic,
  keywords,
  researchNotes,
  topicDescription,
  topicImages,
  targetLength = 1500,
}: GeminiBlogRequest): Promise<GeminiBlogResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const keywordsList = keywords.length > 0 ? keywords.join(", ") : "general fencing topics";
  const researchContext = researchNotes
    ? `\n\nAdditional research context:\n${researchNotes}`
    : "";
  const scopeContext = topicDescription
    ? `\n\nArticle scope (what to cover):\n${topicDescription}`
    : "";
  const imagesContext =
    topicImages && topicImages.length > 0
      ? `\n\nUse these images in the article where appropriate. Include each with markdown image syntax and use the description for alt text. Place them in relevant sections.\n${topicImages.map((img) => `- URL: ${img.url}\n  Description/use: ${img.description}`).join("\n")}`
      : "";

  const prompt = `You are an expert blog writer specializing in fence installation, maintenance, and related topics for homeowners and contractors in the Seattle/Pacific Northwest area.

Write a comprehensive, SEO-optimized blog post about: ${topic}

Keywords to focus on: ${keywordsList}${researchContext}${scopeContext}${imagesContext}

CRITICAL FORMATTING REQUIREMENTS - Follow these exactly for polished, professional output:

1. AVOID WALLS OF TEXT (very important):
   - Keep paragraphs SHORT: 2–4 sentences maximum. Break long explanations into multiple short paragraphs or into lists.
   - Never write a long "list" as bolded phrases followed by long sentences on the same line. Always use real markdown lists.
   - For any set of rules, steps, or options: use bullet lists (- item) or numbered lists (1. step). Do not use bold headings as fake list items with paragraphs underneath.
   - After every 2–3 paragraphs, add a visual break: a short Callout, a list, a table, or a subheading. Avoid more than 3 paragraphs in a row without a break.

2. CONTENT STRUCTURE:
   - Use ## for main sections (e.g., "The Foundation of Your Fence Investment")
   - Use ### for sub-sections
   - Bold key terms within paragraphs (e.g., **fencing installation**, **Enhanced Privacy**)
   - Use numbered lists (1., 2., 3.) for steps or sequential info
   - Use bullet lists (- item) for feature lists, options, or rule summaries
   - For regulatory/process sections (e.g. permits, height limits): lead with 1–2 short sentences, then use a bullet or numbered list for the actual rules/steps

3. COMPARISON TABLES:
   - When comparing two or more options (e.g., steel vs wood, options A vs B), include a markdown table:
   | Feature | Option A | Option B |
   |---------|----------|----------|
   | Cost | $X | $Y |
   - Tables will render in a polished Card with proper styling

4. CALLOUT BOXES - Use ONLY the exact component name <Callout>:
   - Use <Callout title="Real-world failure">...explanation...</Callout> for warnings or key takeaways
   - Use <Callout title="Pro tip" variant="success">...tip...</Callout> for positive tips
   - Use <Callout title="Important" variant="info">...info...</Callout> for general notes
   - NEVER use ProTip, ProTtip, or any other name - only <Callout>
   - Place callouts after relevant paragraphs or image descriptions

5. IMAGES (strict format):
   - Every image MUST use exactly: ![Alt text here](url) — opening bracket [ after !, then closing ], then (url). Never use ! without brackets (e.g. "!Alt text" is wrong).
   - Example: ![Cedar fence in Seattle backyard](https://example.com/cedar-fence.jpg)
   - For side-by-side images, wrap in <ImageGrid columns={2}> and put each image on its own line (authors can add ImageGrid manually if needed)
   - Suggest a featured_image URL if relevant (e.g., product photo, hero image). Use a placeholder like "/images/hero-placeholder.jpg" if no specific image

6. IMAGE CAPTIONS:
   - If using a product or vendor image, suggest imageCaption: "Image courtesy of [Vendor Name]" with optional link

7. LAYOUT:
   - Use layout: "centered" for comparison/guide posts (title centered, hero image below, Article Summary box)
   - Use layout: "two-column" for how-to or narrative posts (title + image side-by-side)
   - Set showArticleSummary: true for longer posts (1000+ words) to enable AI summary CTA

8. METADATA:
   - category: One of "Pricing", "Materials", "Legal", "Maintenance", "Installation", "Fence Posts", "DIY", "Design"
   - readTime: Estimate based on word count (e.g., "8 min read")
   - metaDescription: 120-160 characters, SEO-optimized

Format your response as JSON:
{
  "title": "Blog post title",
  "content": "Full MDX content with markdown tables, Callout components, proper headings, and bolded key terms",
  "metaDescription": "SEO meta description",
  "category": "Category name",
  "readTime": "X min read",
  "featuredImage": "/path/or/url or empty string",
  "imageCaption": "Image courtesy of Vendor" or empty string,
  "layout": "centered" or "two-column",
  "showArticleSummary": true or false
}

Start writing now. Output valid JSON only.`;

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
      // Ensure we use the article body, never the raw JSON string
      let content = parsed.content ?? parsed.body ?? "";
      if (typeof content !== "string" || content.trim().length === 0) {
        content = generatedText;
      }
      if (content.trimStart().startsWith("{")) {
        // Accidentally got raw JSON as content; use a safe fallback
        content = `# ${parsed.title || topic}\n\nArticle content could not be extracted. Please retry.`;
      }
      return {
        title: parsed.title || topic,
        content,
        metaDescription: parsed.metaDescription || `Learn about ${topic.toLowerCase()}`,
        category: parsed.category,
        readTime: parsed.readTime || "5 min read",
        featuredImage: parsed.featuredImage,
        imageCaption: parsed.imageCaption,
        layout: parsed.layout,
        showArticleSummary: parsed.showArticleSummary,
      };
    } catch (parseError) {
      // If JSON parsing fails, do not use raw JSON as body
      const titleMatch = generatedText.match(/title["\s:]+"([^"]+)"/i) ||
                        generatedText.match(/#\s+(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : topic;
      const isLikelyJson = generatedText.trimStart().startsWith("{");
      const content = isLikelyJson
        ? `# ${title}\n\nResponse was not valid JSON. Please try writing this topic again.`
        : generatedText;

      return {
        title,
        content,
        metaDescription: `Learn about ${topic.toLowerCase()}`,
        readTime: "5 min read",
      };
    }
  } catch (error: any) {
    console.error("Gemini API error:", error);
    throw new Error(`Failed to generate blog post: ${error.message}`);
  }
}

// --- Topic research (user idea → suggested title + description) ---

export interface InvestigateTopicResult {
  suggestedTitle: string;
  description: string;
  keywords: string[];
}

/**
 * Quick research on a user's topic idea. Returns suggested title and brief description for the article.
 */
export async function investigateTopic(idea: string): Promise<InvestigateTopicResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const prompt = `You are a content strategist for a fence company blog (MyFence.com) in Seattle/Pacific Northwest.

The user has this topic idea: "${idea.replace(/"/g, "'")}"

Respond with valid JSON only. No markdown, no code fences, no extra text.
- suggestedTitle: one clear SEO-friendly article title, under 70 characters
- description: 2-3 sentences on what the article will cover (escape any quotes inside as \\")
- keywords: array of 3-6 SEO keywords

Example:
{"suggestedTitle":"Your Title Here","description":"Short description. Second sentence.","keywords":["keyword1","keyword2","keyword3"]}`;

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Invalid Gemini response");

  let jsonText = text.trim().replace(/^```json?\n?/i, "").replace(/\n?```\s*$/, "").trim();

  const fallbackResult: InvestigateTopicResult = {
    suggestedTitle: idea.slice(0, 70),
    description: "AI research could not be parsed. You can edit the title and description below.",
    keywords: [],
  };

  try {
    const parsed = JSON.parse(jsonText);
    return {
      suggestedTitle: String(parsed.suggestedTitle ?? idea).slice(0, 70),
      description: String(parsed.description ?? ""),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
    };
  } catch {
    // Try to extract a JSON object from the response (model may have added text or truncated)
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const extracted = jsonText.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(extracted);
        return {
          suggestedTitle: String(parsed.suggestedTitle ?? idea).slice(0, 70),
          description: String(parsed.description ?? ""),
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        };
      } catch {
        // Fall through to fallback
      }
    }
    return fallbackResult;
  }
}

/**
 * Suggest topic ideas when the user is stuck. Returns a list of short topic ideas.
 */
export async function suggestTopicIdeas(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const prompt = `You are a content strategist for a fence company blog (MyFence.com) in Seattle/Pacific Northwest.

The user is stuck and needs topic ideas. Suggest 6 short, specific topic ideas that would make good blog posts for homeowners. Focus on: fence materials, installation, maintenance, costs, legal/neighbor issues, design, and local (Seattle/PNW) relevance.

Respond with JSON only:
{
  "ideas": [
    "First topic idea in a few words",
    "Second topic idea",
    ...
  ]
}`;

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Invalid Gemini response");

  let jsonText = text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed.ideas) ? parsed.ideas : [];
}
