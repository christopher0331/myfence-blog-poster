"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertCircle,
  Target,
  Plus,
  FileText,
  BarChart3,
} from "lucide-react";
import { competitorApi } from "@/lib/api";
import type {
  CompetitorAnalysisResult,
  CompetitorOpportunity,
} from "@/lib/types";

export default function CompetitorAnalysisPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CompetitorAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processCSV = useCallback(async (csvText: string) => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setCreatedCount(null);

    try {
      const data = await competitorApi.analyze(csvText);
      setResult(data);

      // Auto-select all uncovered high/medium priority opportunities
      const autoSelect = new Set<string>();
      data.opportunities.forEach((opp) => {
        if (!opp.alreadyCovered && opp.priority !== "low") {
          autoSelect.add(opp.competitorUrl);
        }
      });
      setSelected(autoSelect);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) processCSV(text);
      };
      reader.readAsText(file);
    },
    [processCSV],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllGaps = () => {
    if (!result) return;
    const all = new Set<string>();
    result.opportunities.forEach((opp) => {
      if (!opp.alreadyCovered) all.add(opp.competitorUrl);
    });
    setSelected(all);
  };

  const handleCreateTopics = async () => {
    if (!result) return;
    const selectedOpps = result.opportunities.filter(
      (o) => selected.has(o.competitorUrl) && !o.alreadyCovered,
    );
    if (selectedOpps.length === 0) return;

    setCreating(true);
    try {
      const res = await competitorApi.createTopics(selectedOpps);
      setCreatedCount(res.created);
    } catch (err: any) {
      setError(err.message || "Failed to create topics");
    } finally {
      setCreating(false);
    }
  };

  const gaps = result?.opportunities.filter((o) => !o.alreadyCovered) || [];
  const covered = result?.opportunities.filter((o) => o.alreadyCovered) || [];

  const trendIcon = (trend: string) => {
    if (trend === "growing")
      return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (trend === "declining")
      return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const priorityVariant = (p: string) => {
    if (p === "high") return "destructive" as const;
    if (p === "medium") return "warning" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Competitor Analysis
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload a SEMrush organic pages report to find content gaps and
          generate topics automatically
        </p>
      </div>

      {/* Upload area */}
      {!result && !analyzing && (
        <Card>
          <CardContent className="p-0">
            <label
              htmlFor="csv-upload"
              className={`flex flex-col items-center justify-center p-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-semibold mb-1">
                Drop SEMrush CSV here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse — Organic Pages report (*.csv)
              </p>
              <Button variant="outline" asChild>
                <span>Choose File</span>
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {analyzing && (
        <Card>
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Analyzing competitor content...
            </h3>
            <p className="text-muted-foreground">
              Parsing CSV, cross-referencing your blog, and identifying
              opportunities with AI. This may take 15-30 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Analysis failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setError(null);
                  setResult(null);
                }}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{result.totalPages}</p>
                <p className="text-xs text-muted-foreground">
                  Total Pages
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{result.contentPages}</p>
                <p className="text-xs text-muted-foreground">
                  Content Pages
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-5 w-5 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">
                  {result.gaps}
                </p>
                <p className="text-xs text-muted-foreground">
                  Content Gaps
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-600">
                  {result.alreadyCovered}
                </p>
                <p className="text-xs text-muted-foreground">
                  Already Covered
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action bar */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {selected.size} topic{selected.size !== 1 ? "s" : ""}{" "}
                  selected
                </p>
                <p className="text-sm text-muted-foreground">
                  High-priority topics will be set to &quot;Ready&quot; for
                  immediate AI writing. Others start as
                  &quot;Preparing&quot;.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={selectAllGaps}>
                  Select All Gaps
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleCreateTopics}
                  disabled={creating || selected.size === 0}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create {selected.size} Topic
                  {selected.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </CardContent>
          </Card>

          {createdCount !== null && (
            <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">
                    Created {createdCount} new topics
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    High-priority topics are ready for AI writing. Check the{" "}
                    <a
                      href="/topics"
                      className="underline font-medium"
                    >
                      Research Topics
                    </a>{" "}
                    page to review.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Gaps */}
          {gaps.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-red-500" />
                Content Gaps ({gaps.length})
              </h2>
              <div className="space-y-3">
                {gaps.map((opp) => (
                  <OpportunityCard
                    key={opp.competitorUrl}
                    opp={opp}
                    isSelected={selected.has(opp.competitorUrl)}
                    onToggle={() => toggleSelect(opp.competitorUrl)}
                    trendIcon={trendIcon}
                    priorityVariant={priorityVariant}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Already Covered */}
          {covered.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Already Covered ({covered.length})
              </h2>
              <div className="space-y-3">
                {covered.map((opp) => (
                  <Card
                    key={opp.competitorUrl}
                    className="opacity-60"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <h4 className="font-semibold text-sm truncate">
                              {opp.suggestedTitle}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                            {opp.competitorUrl}
                          </p>
                          {opp.existingSlug && (
                            <p className="text-xs text-green-600">
                              Our article: /blog/{opp.existingSlug}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                          <span>{opp.estimatedTraffic} traffic</span>
                          {trendIcon(opp.trafficTrend)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upload another */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setError(null);
                setSelected(new Set());
                setCreatedCount(null);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Analyze Another Competitor
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function OpportunityCard({
  opp,
  isSelected,
  onToggle,
  trendIcon,
  priorityVariant,
}: {
  opp: CompetitorOpportunity;
  isSelected: boolean;
  onToggle: () => void;
  trendIcon: (t: string) => React.ReactNode;
  priorityVariant: (p: string) => "destructive" | "warning" | "secondary";
}) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? "ring-2 ring-primary border-primary"
          : "hover:shadow-md"
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox area */}
          <div className="pt-0.5 flex-shrink-0">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/30"
              }`}
            >
              {isSelected && <CheckCircle className="h-3.5 w-3.5" />}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm mb-1">
                  {opp.suggestedTitle}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {opp.suggestedDescription}
                </p>
              </div>
              <Badge
                variant={priorityVariant(opp.priority)}
                className="flex-shrink-0"
              >
                {opp.priority}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">
                {trendIcon(opp.trafficTrend)}
                {opp.estimatedTraffic} est. traffic
              </span>
              <span>{opp.competitorKeywordCount} keywords</span>
              {opp.infoTraffic > 0 && (
                <span>{opp.infoTraffic} info traffic</span>
              )}
            </div>

            {/* Keywords */}
            {opp.suggestedKeywords?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {opp.suggestedKeywords.slice(0, 5).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] bg-muted px-2 py-0.5 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Competitor URL */}
            <p className="text-[10px] text-muted-foreground/60 mt-2 truncate">
              {opp.competitorUrl}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
