/**
 * Centralised Gemini model selection.
 *
 * Env var precedence:
 *   - GEMINI_MODEL_WRITER   — used when writing full blog posts (quality matters)
 *   - GEMINI_MODEL_EDITOR   — used for inline AI edits
 *   - GEMINI_MODEL_AGENT    — used for agent chat / function-calling loops
 *   - GEMINI_MODEL          — global fallback if the task-specific var isn't set
 *
 * Defaults (as of Gemini 3.1 launch, Feb 2026):
 *   writer: gemini-3.1-pro-preview     — flagship reasoning, 1M context
 *   editor: gemini-3-flash-preview     — pro-level quality, flash speed
 *   agent:  gemini-3-flash-preview     — fast tool-calling loops
 *
 * Stable fallbacks if preview models get deprecated: gemini-2.5-pro / gemini-2.5-flash.
 */

export type GeminiTask = "writer" | "editor" | "agent";

const DEFAULTS: Record<GeminiTask, string> = {
  writer: "gemini-3.1-pro-preview",
  editor: "gemini-3-flash-preview",
  agent: "gemini-3-flash-preview",
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
