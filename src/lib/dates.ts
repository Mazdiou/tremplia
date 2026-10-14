// Fuseau horaire de l'application. Unique pour l'instant : deviendra un
// réglage par agence quand des agences hors Algérie arriveront.
export const APP_TIMEZONE = "Africa/Algiers";

// Date du jour dans le fuseau de l'application, au format AAAA-MM-JJ
export function todayInAppTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    now,
  );
}

// Vraie date au format AAAA-MM-JJ (refuse le 30 février)
export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function daysUntil(dateISO: string, todayISO: string) {
  return Math.round(
    (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) /
      86_400_000,
  );
}

// Date seule (AAAA-MM-JJ), sans décalage de fuseau : « 15 décembre 2026 »
export function formatLongDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Date seule (AAAA-MM-JJ), sans décalage de fuseau : « 15/12/2026 »
export function formatShortDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
  });
}

// Jour d'un instant (created_at…) dans le fuseau de l'application, et non
// celui du serveur : « 15/12/2026 »
export const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
});

export const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIMEZONE,
});

export const shortDateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});
