import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

// Pastille du nombre de messages non lus (9+ au-delà)
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-foreground tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{count > 9 ? "9+" : count}</span>
      <span className="sr-only">
        {plural(count, "message non lu", "messages non lus")}
      </span>
    </span>
  );
}
