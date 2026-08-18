import { cn } from "@/lib/utils";

// Injury designation as a status pill — status color is reserved (never a categorical
// hue) and always paired with the label text, never color alone.
const STATUS_STYLES: Record<string, string> = {
  Out: "bg-destructive/15 text-[oklch(0.78_0.16_25)]",
  Doubtful: "bg-[oklch(0.68_0.15_40/0.18)] text-[oklch(0.80_0.14_45)]",
  Questionable: "bg-[oklch(0.79_0.16_80/0.2)] text-[oklch(0.85_0.14_85)]",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
