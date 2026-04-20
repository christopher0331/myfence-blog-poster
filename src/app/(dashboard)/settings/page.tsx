"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Github,
  Database,
  Key,
  Zap,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useSite } from "@/lib/site-context";
import { cn } from "@/lib/utils";

const DAYS = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

export default function SettingsPage() {
  const { currentSite } = useSite();
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [postsPerWeek, setPostsPerWeek] = useState(2);
  const [postingDays, setPostingDays] = useState<number[]>([1, 4]);
  const [postingHour, setPostingHour] = useState(16);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentSite) return;
    setAutoEnabled(currentSite.auto_publish_enabled ?? true);
    setPostsPerWeek(currentSite.posts_per_week ?? 2);
    setPostingDays(currentSite.posting_days ?? [1, 4]);
    setPostingHour(currentSite.posting_hour_utc ?? 16);
  }, [currentSite?.id]);

  async function saveScheduling() {
    if (!currentSite) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/sites/${currentSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_publish_enabled: autoEnabled,
          posts_per_week: postsPerWeek,
          posting_days: postingDays,
          posting_hour_utc: postingHour,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Failed to save scheduling settings");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(v: number) {
    setPostingDays((prev) =>
      prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort(),
    );
  }

  const selectedDayLabels = postingDays
    .sort()
    .map((d) => DAYS.find((x) => x.v === d)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure integrations and automation for{" "}
          <span className="font-mono text-foreground/80">
            {currentSite?.name || "this site"}
          </span>
        </p>
      </div>

      {/* Auto-publishing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <CardTitle>Auto-publishing</CardTitle>
              <CardDescription>
                Cron auto-schedules {postsPerWeek} post{postsPerWeek === 1 ? "" : "s"}/week
                from <span className="font-mono">ready</span> topics
                {selectedDayLabels && ` on ${selectedDayLabels}`}.
              </CardDescription>
            </div>
            <Toggle checked={autoEnabled} onChange={setAutoEnabled} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Posts per week
              </label>
              <Select
                value={String(postsPerWeek)}
                onChange={(e) => setPostsPerWeek(Number(e.target.value))}
              >
                <option value="1">1 post / week</option>
                <option value="2">2 posts / week</option>
                <option value="3">3 posts / week</option>
                <option value="5">5 posts / week (weekdays)</option>
                <option value="7">7 posts / week (daily)</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Publish hour (UTC)
              </label>
              <Select
                value={String(postingHour)}
                onChange={(e) => setPostingHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00 UTC
                    {h === 16 ? "  ·  ~09:00 PT" : ""}
                    {h === 14 ? "  ·  ~07:00 PT" : ""}
                    {h === 13 ? "  ·  ~09:00 ET" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Posting days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const active = postingDays.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={cn(
                      "h-9 w-12 rounded-md border text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The cron fires daily — drafts get scheduled only for these days, at the hour above.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-success mr-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button onClick={saveScheduling} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save schedule
          </Button>
        </CardFooter>
      </Card>

      {/* GitHub */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground/70">
              <Github className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>GitHub</CardTitle>
              <CardDescription>
                Repository where posts are committed when published.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Owner" value={currentSite?.github_repo_owner || ""} />
            <Field label="Repo" value={currentSite?.github_repo_name || ""} />
            <Field label="Branch" value={currentSite?.github_default_branch || "main"} />
            <Field label="Domain" value={currentSite?.domain || ""} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Access token
            </label>
            <div className="flex items-center gap-2">
              <Input value="••••••••••••••••" disabled className="font-mono" />
              <Badge variant="outline">env var</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supabase */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground/70">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Supabase</CardTitle>
              <CardDescription>
                Database backing drafts, topics, competitor analyses, and feedback.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Field
            label="Project URL"
            value={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
            mono
          />
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground/70">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                NextAuth credentials auth.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sign-in enforced via NextAuth. Configure users / secrets in env vars.
        </CardContent>
      </Card>

      {/* Business context */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground/70">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Business context</CardTitle>
              <CardDescription>
                Used by the AI when generating blog posts and meta descriptions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Business description" value={currentSite?.business_description || ""} />
          <Field label="Location" value={currentSite?.location || ""} />
          <Field
            label="Notify emails"
            value={(currentSite?.notify_emails || []).join(", ")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <Input
        value={value}
        disabled
        className={mono ? "font-mono text-xs" : undefined}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors",
        checked
          ? "bg-primary border-primary"
          : "bg-muted border-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
