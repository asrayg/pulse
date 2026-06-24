import "server-only";
import crypto from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for external data-source credentials.
 * The key comes from PULSE_ENCRYPTION_KEY (base64 or hex, 32 bytes). If unset
 * we derive a stable dev key from AUTH_SECRET so local dev still works.
 */
function getKey(): Buffer {
  const raw = process.env.PULSE_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  }
  // Fallback: derive from AUTH_SECRET (dev only).
  return crypto
    .createHash("sha256")
    .update(process.env.AUTH_SECRET ?? "pulse-dev-secret")
    .digest();
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptJson<T = unknown>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    const key = getKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}
