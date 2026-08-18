import { cn } from "@/lib/utils";

// Grade color follows performance, not the brand accent — an A+ roster shouldn't look
// identical to an F roster just because both use the theme color. This is a semantic
// (good/warning/critical) encoding layered on top of the letter itself.
function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "oklch(0.75 0.16 145)"; // success green
  if (grade.startsWith("B")) return "oklch(0.80 0.15 75)"; // accent amber
  if (grade.startsWith("C")) return "oklch(0.79 0.16 80)"; // warning
  if (grade.startsWith("D")) return "oklch(0.68 0.15 40)"; // serious
  return "oklch(0.62 0.19 25)"; // critical red for F
}

export function GradeTile({ label, grade, detail }: { label: string; grade: string; detail: string }) {
  const color = gradeColor(grade);
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5">
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-[0.15] blur-2xl"
        style={{ backgroundColor: color }}
      />
      <div className="relative">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
        <div
          className={cn("mt-1 font-heading text-6xl font-semibold leading-none")}
          style={{ color, textShadow: `0 0 24px color-mix(in oklch, ${color} 45%, transparent)` }}
        >
          {grade}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
