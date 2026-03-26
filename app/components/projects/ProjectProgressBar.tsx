"use client";

import { cn } from "@/lib/utils";

interface Props {
  progress: number;
  showLabel?: boolean;
  className?: string;
}

export function ProjectProgressBar({ progress, showLabel = true, className }: Props) {
  const clamped = Math.min(100, Math.max(0, progress));

  const barColor =
    clamped === 100
      ? "bg-green-500"
      : clamped >= 60
      ? "bg-blue-500"
      : clamped >= 30
      ? "bg-yellow-500"
      : "bg-muted-foreground/40";

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Avance</span>
          <span className="font-semibold tabular-nums">{clamped}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
