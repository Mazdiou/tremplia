import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

// Pastille du nombre de messages non lus (9+ au-delà). `what` : ce qui est
// compté, lu par les lecteurs d'écran (singulier, pluriel)
export function UnreadBadge({
  count,
  className,
  what = ["message non lu", "messages non lus"],
}: {
  count: number;
  className?: string;
  what?: [string, string];
}) {
  return (
    <span
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-semibold text-primary-foreground tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{count > 9 ? "9+" : count}</span>
      <span className="sr-only">
        {plural(count, what[0], what[1])}
      </span>
    </span>
  );
}
