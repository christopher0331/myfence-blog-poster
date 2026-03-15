export type TopicSource = "user" | "ai";
export type TopicStatus = "preparing" | "ready" | "in_progress" | "completed";
export type DraftStatus = "draft" | "review" | "scheduled" | "published" | "failed";

export interface SiteConfig {
  id: string;
  name: string;
  abbreviation: string;
  domain: string;
  github_repo_owner: string;
  github_repo_name: string;
  github_default_branch: string;
  business_description: string;
  location: string;
  notify_emails: string[];
  blog_path_prefix: string;
}

export interface TopicImage {
  url: string;
  description: string;
}

export interface BlogTopic {
  id: string;
  title: string;
  description: string | null;
  source: TopicSource;
  status: TopicStatus;
  keywords: string[];
  research_notes: string | null;
  progress_status: string | null;
  priority: number;
  topic_images: TopicImage[];
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
  scheduled_publish_at: string | null;
  published_at: string | null;
  github_pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorOpportunity {
  competitorUrl: string;
  competitorSlug: string;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedKeywords: string[];
  estimatedTraffic: number;
  infoTraffic: number;
  competitorKeywordCount: number;
  trafficTrend: "growing" | "stable" | "declining";
  priority: "high" | "medium" | "low";
  alreadyCovered: boolean;
  existingSlug?: string;
}

export interface CompetitorAnalysisResult {
  id?: string;
  competitor: string;
  totalPages: number;
  contentPages: number;
  opportunities: CompetitorOpportunity[];
  alreadyCovered: number;
  gaps: number;
  created_at?: string;
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
