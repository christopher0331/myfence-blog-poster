import type { BlogDraft, BlogTopic } from "./types";

const API_BASE = "/api";

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

    const response = await fetch(`${API_BASE}/drafts?${params.toString()}`);
    return handleResponse<BlogDraft[]>(response);
  },

  async getById(id: string): Promise<BlogDraft> {
    const response = await fetch(`${API_BASE}/drafts/${id}`);
    return handleResponse<BlogDraft>(response);
  },

  async create(data: Partial<BlogDraft>): Promise<BlogDraft> {
    const response = await fetch(`${API_BASE}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogDraft>(response);
  },

  async update(id: string, data: Partial<BlogDraft>): Promise<BlogDraft> {
    const response = await fetch(`${API_BASE}/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogDraft>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/drafts/${id}`, {
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

    const response = await fetch(`${API_BASE}/topics?${params.toString()}`);
    return handleResponse<BlogTopic[]>(response);
  },

  async create(data: Partial<BlogTopic>): Promise<BlogTopic> {
    const response = await fetch(`${API_BASE}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogTopic>(response);
  },

  async update(id: string, data: Partial<BlogTopic>): Promise<BlogTopic> {
    const response = await fetch(`${API_BASE}/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<BlogTopic>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/topics/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async investigate(idea: string): Promise<{ suggestedTitle: string; description: string; keywords: string[] }> {
    const response = await fetch(`${API_BASE}/topics/investigate`, {
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
    const response = await fetch(`${API_BASE}/topics/suggest-ideas`, {
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
