export type TopicSource = "user" | "ai";
export type TopicStatus = "suggested" | "approved" | "in_progress" | "completed" | "rejected";
export type DraftStatus = "draft" | "review" | "scheduled" | "published" | "failed";

export interface BlogTopic {
  id: string;
  title: string;
  source: TopicSource;
  status: TopicStatus;
  keywords: string[];
  research_notes: string | null;
  progress_status: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface BlogDraft {
  id: string;
  topic_id: string | null;
  slug: string;
  title: string;
  meta_description: string;
  body_mdx: string;
  category: string;
  featured_image: string;
  read_time: string;
  structured_data: Record<string, any> | null;
  status: DraftStatus;
  completeness: {
    title: number;
    body: number;
    meta_description: number;
    image: number;
    category: number;
    structured_data: number;
  };
  scheduled_date: string | null;
  published_at: string | null;
  github_pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LighthouseScore {
  id: string;
  page_url: string;
  performance: number;
  accessibility: number;
  best_practices: number;
  seo: number;
  measured_at: string;
}
