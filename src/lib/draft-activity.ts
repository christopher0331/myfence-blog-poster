export type DraftActivityStatus = "info" | "success" | "error";

export interface DraftActivityEntry {
  at: string;
  action: string;
  status: DraftActivityStatus;
  message: string;
  details?: Record<string, unknown>;
}

export function appendDraftActivity(
  structuredData: Record<string, any> | null | undefined,
  entry: Omit<DraftActivityEntry, "at">,
): Record<string, any> {
  const base = structuredData && typeof structuredData === "object" ? structuredData : {};
  const existing = Array.isArray(base.activityLog) ? base.activityLog : [];
  return {
    ...base,
    activityLog: [
      {
        at: new Date().toISOString(),
        ...entry,
      },
      ...existing,
    ].slice(0, 50),
  };
}
