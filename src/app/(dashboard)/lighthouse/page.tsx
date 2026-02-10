"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LighthouseScore } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 90) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-500";
}

function scoreBg(score: number) {
  if (score >= 90) return "bg-green-100";
  if (score >= 50) return "bg-yellow-100";
  return "bg-red-100";
}

export default function LighthousePage() {
  const [scores, setScores] = useState<LighthouseScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    page_url: "",
    performance: 0,
    accessibility: 0,
    best_practices: 0,
    seo: 0,
  });

  useEffect(() => {
    loadScores();
  }, []);

  async function loadScores() {
    const { data } = await supabase
      .from("lighthouse_scores")
      .select("*")
      .order("measured_at", { ascending: false });

    setScores((data || []) as LighthouseScore[]);
    setLoading(false);
  }

  async function addScore() {
    await supabase.from("lighthouse_scores").insert({
      ...form,
      measured_at: new Date().toISOString(),
    });
    setForm({ page_url: "", performance: 0, accessibility: 0, best_practices: 0, seo: 0 });
    setShowForm(false);
    loadScores();
  }

  async function deleteScore(id: string) {
    await supabase.from("lighthouse_scores").delete().eq("id", id);
    loadScores();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lighthouse Scores</h1>
          <p className="text-muted-foreground mt-1">
            Track performance, accessibility, and SEO scores
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Score
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Record Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Page URL</label>
              <Input
                value={form.page_url}
                onChange={(e) => setForm({ ...form, page_url: e.target.value })}
                placeholder="https://myfence.com/blog/..."
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {(["performance", "accessibility", "best_practices", "seo"] as const).map(
                (field) => (
                  <div key={field}>
                    <label className="text-sm font-medium mb-1 block capitalize">
                      {field.replace("_", " ")}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form[field]}
                      onChange={(e) =>
                        setForm({ ...form, [field]: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={addScore} disabled={!form.page_url}>
                Save Score
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading scores...</p>
      ) : scores.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gauge className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scores recorded</h3>
            <p className="text-muted-foreground">
              Add Lighthouse scores to track page performance over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scores.map((score) => (
            <Card key={score.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{score.page_url}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(score.measured_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {(
                      [
                        { label: "Perf", value: score.performance },
                        { label: "A11y", value: score.accessibility },
                        { label: "BP", value: score.best_practices },
                        { label: "SEO", value: score.seo },
                      ] as const
                    ).map((metric) => (
                      <div key={metric.label} className="text-center w-14">
                        <div
                          className={`text-lg font-bold ${scoreColor(metric.value)}`}
                        >
                          {metric.value}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {metric.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => deleteScore(score.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
