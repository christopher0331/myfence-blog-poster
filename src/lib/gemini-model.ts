/**
 * Centralised Gemini model selection.
 *
 * Env var precedence:
 *   - GEMINI_MODEL_WRITER   — used when writing full blog posts (quality matters)
 *   - GEMINI_MODEL_EDITOR   — used for inline AI edits
 *   - GEMINI_MODEL_AGENT    — used for agent chat / function-calling loops
 *   - GEMINI_MODEL          — global fallback if the task-specific var isn't set
 *
 * Defaults:
 *   writer: gemini-2.5-pro   (higher quality, slightly slower)
 *   editor: gemini-2.5-flash (fast, cheap — edits are small delta ops)
 *   agent:  gemini-2.5-flash (many tool-calling roundtrips; latency matters)
 */

export type GeminiTask = "writer" | "editor" | "agent";

const DEFAULTS: Record<GeminiTask, string> = {
  writer: "gemini-2.5-pro",
  editor: "gemini-2.5-flash",
  agent: "gemini-2.5-flash",
};

export function geminiModel(task: GeminiTask): string {
  const taskEnv =
    task === "writer"
      ? process.env.GEMINI_MODEL_WRITER
      : task === "editor"
        ? process.env.GEMINI_MODEL_EDITOR
        : process.env.GEMINI_MODEL_AGENT;
  return (taskEnv || process.env.GEMINI_MODEL || DEFAULTS[task]).trim();
}
