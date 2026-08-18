import { cn } from "@/lib/utils";

// Fixed per-position color coding (categorical identity, not decorative) so a position
// reads at a glance across dense lists — same idea as a legend, just inline.
const POSITION_STYLES: Record<string, string> = {
  QB: "bg-[oklch(0.62_0.19_25/0.16)] text-[oklch(0.78_0.15_30)]",
  RB: "bg-[oklch(0.62_0.17_145/0.16)] text-[oklch(0.75_0.16_145)]",
  WR: "bg-[oklch(0.80_0.15_75/0.16)] text-[oklch(0.82_0.14_75)]",
  TE: "bg-[oklch(0.66_0.15_230/0.16)] text-[oklch(0.78_0.12_230)]",
  K: "bg-[oklch(0.66_0.02_100/0.2)] text-[oklch(0.80_0.02_100)]",
  DEF: "bg-[oklch(0.66_0.02_100/0.2)] text-[oklch(0.80_0.02_100)]",
};

export function PositionBadge({ position, className }: { position: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        POSITION_STYLES[position] ?? "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {position}
    </span>
  );
}
