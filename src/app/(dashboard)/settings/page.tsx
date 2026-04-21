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
  Sparkles,
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

      {/* AI Models */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>AI Models</CardTitle>
              <CardDescription>
                Gemini models used for each task. Set via env vars — changes require a redeploy.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ModelField
              label="Writer"
              envVar="GEMINI_MODEL_WRITER"
              description="Blog post generation"
              recommended="gemini-3.1-pro-preview"
            />
            <ModelField
              label="Editor"
              envVar="GEMINI_MODEL_EDITOR"
              description="Inline AI edits"
              recommended="gemini-3-flash-preview"
            />
            <ModelField
              label="Agent"
              envVar="GEMINI_MODEL_AGENT"
              description="Chat & tool calls"
              recommended="gemini-3-flash-preview"
            />
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">To change models</p>
            <p>Add to <code className="font-mono bg-muted px-1 rounded">.env.local</code> locally or Netlify → Site settings → Environment variables, then redeploy:</p>
            <pre className="mt-2 font-mono bg-muted/60 rounded p-2 text-[11px] overflow-x-auto whitespace-pre">{`GEMINI_MODEL_WRITER=gemini-3.1-pro-preview\nGEMINI_MODEL_EDITOR=gemini-3-flash-preview\nGEMINI_MODEL_AGENT=gemini-3-flash-preview`}</pre>
            <p className="pt-1">
              <strong>gemini-3.1-pro-preview</strong> requires billing enabled on your Google Cloud project.{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Manage API key →
              </a>
            </p>
          </div>
        </CardContent>
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

const GEMINI_MODELS = [
  { id: "gemini-3.1-pro-preview", label: "3.1 Pro Preview", tier: "paid" },
  { id: "gemini-3.1-pro-preview-customtools", label: "3.1 Pro (Custom Tools)", tier: "paid" },
  { id: "gemini-3-flash-preview", label: "3 Flash Preview", tier: "free" },
  { id: "gemini-3.1-flash-lite-preview", label: "3.1 Flash Lite", tier: "free" },
  { id: "gemini-2.5-pro", label: "2.5 Pro (stable)", tier: "paid" },
  { id: "gemini-2.5-flash", label: "2.5 Flash (stable)", tier: "free" },
];

function ModelField({
  label,
  envVar,
  description,
  recommended,
}: {
  label: string;
  envVar: string;
  description: string;
  recommended: string;
}) {
  const current = GEMINI_MODELS.find((m) => m.id === recommended);
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
        {label}
        <span className="normal-case font-normal text-[10px] text-muted-foreground/60">— {description}</span>
      </div>
      <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
        <div className="font-mono text-xs text-foreground/90 truncate">{recommended}</div>
        {current && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border",
              current.tier === "paid"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-success/40 bg-success/10 text-success"
            )}>
              {current.tier === "paid" ? "billing req'd" : "free tier ok"}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{envVar}</span>
          </div>
        )}
      </div>
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
