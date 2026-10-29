"use client";

import { useState } from "react";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  PREFERENCE_KEYS,
  preferenceInfo,
  type NotificationPreferences,
} from "../schemas";

// Ce que le membre veut recevoir, pour lui seul et sur tous ses appareils.
// Chaque case est enregistrée dès qu'elle change.
export function NotificationPreferencesForm({
  initial,
  isOwner,
  readOnly,
}: {
  initial: NotificationPreferences;
  isOwner: boolean;
  // Abonnement expiré
  readOnly: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);
  const info = preferenceInfo(isOwner);

  async function toggle(key: keyof NotificationPreferences) {
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    setMessage(null);
    const res = await callApi("/api/settings/notifications", { method: "PUT", body: next });
    setSaving(false);
    if (!res.ok) {
      setPrefs(previous);
      return setMessage({ text: res.error, error: true });
    }
    setMessage({ text: "Préférences enregistrées", error: false });
  }

  return (
    <fieldset className="space-y-2" disabled={readOnly}>
      <legend className="mb-2 text-sm font-medium">Me prévenir pour</legend>
      <div className="grid gap-2 @md:grid-cols-2">
        {PREFERENCE_KEYS.map((key) => (
          <label
            key={key}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 text-sm transition-colors",
              prefs[key] && "border-primary",
              readOnly && "cursor-default opacity-70",
            )}
          >
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={saving || readOnly}
              onChange={() => void toggle(key)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block font-medium">{info[key].label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {info[key].description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <StatusMessage message={message} />
    </fieldset>
  );
}
