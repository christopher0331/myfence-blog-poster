"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletenessField {
  label: string;
  key: string;
  value: number;
}

interface CompletenessTrackerProps {
  fields: CompletenessField[];
}

export default function CompletenessTracker({ fields }: CompletenessTrackerProps) {
  const overall = Math.round(
    fields.reduce((sum, f) => sum + f.value, 0) / fields.length
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Completeness
        </h3>
        <span
          className={cn(
            "text-lg font-bold",
            overall >= 80 ? "text-green-600" : overall >= 50 ? "text-yellow-600" : "text-red-500"
          )}
        >
          {overall}%
        </span>
      </div>
      <Progress value={overall} className="h-3" />

      <div className="space-y-2 mt-4">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-2 text-sm">
            {field.value >= 100 ? (
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : field.value > 0 ? (
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
            )}
            <span
              className={cn(
                "flex-1",
                field.value >= 100 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {field.label}
            </span>
            <span className="text-xs text-muted-foreground">{field.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
