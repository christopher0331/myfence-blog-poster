"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Github, Database, Key, FileEdit } from "lucide-react";

type ArticleBuildMode = "manual" | "cron";

export default function SettingsPage() {
  const [articleBuildMode, setArticleBuildMode] = useState<ArticleBuildMode>("manual");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.article_build_mode === "cron" || data.article_build_mode === "manual") {
          setArticleBuildMode(data.article_build_mode);
        }
      } catch {
        // keep default manual
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  async function handleArticleBuildModeChange(value: string) {
    const mode = value === "cron" ? "cron" : "manual";
    setSavingMode(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_build_mode: mode }),
      });
      if (res.ok) {
        setArticleBuildMode(mode);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save");
      }
    } finally {
      setSavingMode(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure integrations and preferences
        </p>
      </div>

      {/* Article build mode */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileEdit className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Article build</CardTitle>
              <CardDescription>
                Choose whether blog posts are written and published manually from Studio or by the scheduled cron job only.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Mode</label>
            <Select
              value={articleBuildMode}
              onChange={(e) => handleArticleBuildModeChange(e.target.value)}
              disabled={settingsLoading || savingMode}
              className="max-w-xs"
            >
              <option value="manual">Manual only</option>
              <option value="cron">Cron only</option>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Manual only: use &quot;Write blog&quot; / &quot;Commit to GitHub&quot; in the app; cron will do nothing.
            Cron only: the scheduled job writes and publishes from approved topics; manual commit is disabled.
          </p>
        </CardContent>
      </Card>

      {/* GitHub Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">GitHub Integration</CardTitle>
              <CardDescription>
                Configure the repository where blog posts are published
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Repo Owner</label>
              <Input
                value={process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER || ""}
                disabled
                placeholder="Set via GITHUB_REPO_OWNER env var"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Repo Name</label>
              <Input
                value={process.env.NEXT_PUBLIC_GITHUB_REPO_NAME || ""}
                disabled
                placeholder="Set via GITHUB_REPO_NAME env var"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">GitHub Token</label>
            <div className="flex items-center gap-2">
              <Input value="••••••••••••••••" disabled className="font-mono" />
              <Badge variant="outline">Environment Variable</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            GitHub settings are configured via environment variables for security.
            Update them in your deployment platform or <code>.env.local</code> file.
          </p>
        </CardContent>
      </Card>

      {/* Supabase */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Supabase</CardTitle>
              <CardDescription>
                Database connection for blog drafts, topics, and scores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <label className="text-sm font-medium mb-1 block">Project URL</label>
            <Input
              value={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
              disabled
              className="font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Configured via <code>NEXT_PUBLIC_SUPABASE_URL</code> environment variable.
          </p>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Authentication</CardTitle>
              <CardDescription>
                Google OAuth configuration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Authentication is handled via Google OAuth through NextAuth.js.
            To restrict access, set the <code>ALLOWED_EMAILS</code> environment variable
            with a comma-separated list of authorized email addresses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
