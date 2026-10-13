import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env-server";

const KEY_VERSION = 1;

function getKey(): Buffer {
  return serverEnv().externalAccountsKey;
}

// `aad` lie le texte chiffré à son compte (agence:compte) : une valeur copiée
// dans la ligne d'un autre compte ne se déchiffre pas.
export function encryptSecret(plain: string, aad: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    value: Buffer.concat([iv, tag, data]).toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptSecret(encoded: string, aad: string): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
