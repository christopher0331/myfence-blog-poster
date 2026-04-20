import type { BlogDraft, BlogTopic, CompetitorAnalysisResult, CompetitorOpportunity } from "./types";

const API_BASE = "/api";
const DEFAULT_SITE_ID = "11111111-1111-1111-1111-111111111111";

function getCurrentSiteId() {
  if (typeof window === "undefined") return DEFAULT_SITE_ID;
  return window.localStorage.getItem("selected-site-id") || DEFAULT_SITE_ID;
}

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("x-site-id", getCurrentSiteId());
  return fetch(input, { ...init, headers });
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.data || data;
}

// Drafts API
export const draftsApi = {
  async getAll(filters?: {
    status?: string;
    scheduledDateGte?: string;
    scheduledDateLte?: string;
    scheduledDateNotNull?: boolean;
    order?: string;
    ascending?: boolean;
  }): Promise<BlogDraft[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.scheduledDateGte) params.set("scheduled_date_gte", filters.scheduledDateGte);
    if (filters?.scheduledDateLte) params.set("scheduled_date_lte", filters.scheduledDateLte);
    if (filters?.scheduledDateNotNull) params.set("scheduled_date_not_null", "true");
    if (filters?.order) params.set("order", filters.order);
    if (filters?.ascending !== undefined) params.set("ascending", String(filters.ascending));

    const response = await apiFetch(`${API_BASE}/drafts?${params.toString()}`);
    return handleResponse<BlogDraft[]>(response);
  },

  async getById(id: string): Promise<BlogDraft> {
    const response = await apiFetch(`${API_BASE}/drafts/${id}`);
    return handleResponse<BlogDraft>(response);
  },

  async create(data: Partial<BlogDraft>): Promise<BlogDraft> {
    const response = await apiFetch(`${API_BASE}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogDraft>(response);
  },

  async update(id: string, data: Partial<BlogDraft>): Promise<BlogDraft> {
    const response = await apiFetch(`${API_BASE}/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogDraft>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await apiFetch(`${API_BASE}/drafts/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },
};

// Topics API
export const topicsApi = {
  async getAll(filters?: {
    order?: string;
    ascending?: boolean;
  }): Promise<BlogTopic[]> {
    const params = new URLSearchParams();
    if (filters?.order) params.set("order", filters.order);
    if (filters?.ascending !== undefined) params.set("ascending", String(filters.ascending));

    const response = await apiFetch(`${API_BASE}/topics?${params.toString()}`);
    return handleResponse<BlogTopic[]>(response);
  },

  async create(data: Partial<BlogTopic>): Promise<BlogTopic> {
    const response = await apiFetch(`${API_BASE}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogTopic>(response);
  },

  async update(id: string, data: Partial<BlogTopic>): Promise<BlogTopic> {
    const response = await apiFetch(`${API_BASE}/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogTopic>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await apiFetch(`${API_BASE}/topics/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async investigate(idea: string): Promise<{ suggestedTitle: string; description: string; keywords: string[] }> {
    const response = await apiFetch(`${API_BASE}/topics/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Investigate failed");
    }
    return response.json();
  },

  async suggestIdeas(): Promise<string[]> {
    const response = await apiFetch(`${API_BASE}/topics/suggest-ideas`, {
      method: "POST",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Suggest ideas failed");
    }
    const data = await response.json();
    return data.ideas || [];
  },
};

// Competitor Analysis API
export const competitorApi = {
  async load(): Promise<CompetitorAnalysisResult | null> {
    const response = await apiFetch(`${API_BASE}/competitor-analysis`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.analysis || null;
  },

  async analyze(csvText: string): Promise<CompetitorAnalysisResult> {
    const response = await apiFetch(`${API_BASE}/competitor-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze", csvText }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Analysis failed");
    }
    return response.json();
  },

  async createTopics(
    opportunities: CompetitorOpportunity[],
  ): Promise<{ created: number; message: string }> {
    const response = await apiFetch(`${API_BASE}/competitor-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-topics", opportunities }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create topics");
    }
    return response.json();
  },

  async syncOpportunities(
    analysisId: string,
    opportunities: CompetitorOpportunity[],
  ): Promise<void> {
    await apiFetch(`${API_BASE}/competitor-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-opportunities",
        analysisId,
        opportunities,
      }),
    });
  },

  async deleteAnalysis(id: string): Promise<void> {
    await apiFetch(`${API_BASE}/competitor-analysis?id=${id}`, {
      method: "DELETE",
    });
  },
};
