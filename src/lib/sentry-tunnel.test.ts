import { describe, expect, it } from "vitest";
import { tunnelTarget } from "./sentry-tunnel";

const DSN = "https://cle123@o42.ingest.de.sentry.io/4567";
const envelope = (header: unknown) =>
  `${JSON.stringify(header)}\n{"type":"event"}\n{"message":"essai"}`;

describe("tunnel du suivi des erreurs", () => {
  it("transmet au projet attendu, à une adresse construite depuis le DSN du serveur", () => {
    expect(tunnelTarget(envelope({ dsn: DSN, sent_at: "2026-10-19" }), DSN)).toBe(
      "https://o42.ingest.de.sentry.io/api/4567/envelope/",
    );
  });

  it("refuse tout autre projet, hôte, clé ou protocole", () => {
    for (const other of [
      "https://cle123@o42.ingest.de.sentry.io/9999",
      "https://cle123@evil.example/4567",
      "https://cle123@o42.ingest.de.sentry.io.evil.example/4567",
      "https://autre@o42.ingest.de.sentry.io/4567",
      "http://cle123@o42.ingest.de.sentry.io/4567",
      "https://cle123@o42.ingest.de.sentry.io/4567/../9999",
    ]) {
      expect(tunnelTarget(envelope({ dsn: other }), DSN), other).toBeNull();
    }
  });

  it("refuse une enveloppe mal formée ou sans DSN", () => {
    expect(tunnelTarget("", DSN)).toBeNull();
    expect(tunnelTarget("pas du json\n{}", DSN)).toBeNull();
    expect(tunnelTarget(envelope({ sent_at: "x" }), DSN)).toBeNull();
    expect(tunnelTarget(envelope({ dsn: 42 }), DSN)).toBeNull();
    expect(tunnelTarget(envelope({ dsn: "pas une adresse" }), DSN)).toBeNull();
  });

  it("ne transmet rien quand le suivi n'est pas configuré", () => {
    expect(tunnelTarget(envelope({ dsn: DSN }), undefined)).toBeNull();
  });
});
