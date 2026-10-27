import { APP_TIMEZONE, dayFormat, todayInAppTimezone } from "@/lib/dates";
import { initialsOf } from "@/lib/names";

// Petits éléments partagés par les blocs du tableau de bord

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

// « aujourd'hui », « hier », « il y a 2 jours », puis la date
export function relativeDay(iso: string) {
  const d = new Date(iso);
  const diff = Math.round(
    (Date.parse(todayInAppTimezone()) - Date.parse(todayInAppTimezone(d))) / 86_400_000,
  );
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  if (diff < 7) return `il y a ${diff} jours`;
  return dayFormat.format(d);
}

// Heure pour aujourd'hui, sinon jour relatif
export function relativeWhen(iso: string) {
  const diff = relativeDay(iso);
  return diff === "aujourd'hui" ? timeFmt.format(new Date(iso)) : diff;
}

export function Initials({ first, last }: { first: string; last: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[0.6875rem] font-semibold text-accent-foreground"
    >
      {initialsOf(first, last)}
    </span>
  );
}
