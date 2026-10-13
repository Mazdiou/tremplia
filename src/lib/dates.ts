// Fuseau horaire de l'application. Unique pour l'instant : deviendra un
// réglage par agence quand des agences hors Algérie arriveront.
export const APP_TIMEZONE = "Africa/Algiers";

// Date du jour dans le fuseau de l'application, au format AAAA-MM-JJ
export function todayInAppTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    now,
  );
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
