import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitize a string for YAML frontmatter: single line, escaped double quotes. Prevents YAML parse errors on the consumer site. */
export function safeFrontmatterValue(value: string | undefined | null): string {
  if (value == null) return "";
  const oneLine = String(value).replace(/\r?\n/g, " ").trim();
  return oneLine.replace(/"/g, '\\"');
}
