import { randomInt } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout : l'application construite (`npm run build`) tourne
// sur le port 3100, branchée sur le Supabase local (`npx supabase start`).
// Le port 3000 reste libre pour `npm run dev`.
const PORT = 3100;

// Adresse IP propre à chaque lancement : l'inscription est limitée à 3 par
// heure et par adresse (migration rate_limits), et les tests en créent une
const runIp = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

export default defineConfig({
  testDir: "e2e",
  // Un seul parcours, dont chaque étape dépend de la précédente
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Algiers",
    extraHTTPHeaders: { "x-forwarded-for": runIp },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
