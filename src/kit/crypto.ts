import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSecret } from "@/kit/secrets";

/**
 * Field-level encryption for PII (the Dataverse customer-managed-key equivalent, but per field).
 * `Kms` is the seam: the local adapter derives a key from PII_KEY; production wraps a KMS data key
 * (AWS KMS / GCP KMS envelope encryption). Ciphertext format: enc:v1:<iv>:<tag>:<ciphertext> (base64url).
 */
export interface Kms {
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}

const PREFIX = "enc:v1:";

class LocalKms implements Kms {
  private key = createHash("sha256").update(getSecret("PII_KEY")).digest();
  encrypt(plain: string) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return `${PREFIX}${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
  }
  decrypt(cipher: string) {
    if (!isEncrypted(cipher)) return cipher; // legacy/plain value (pre-migration rows)
    const [iv, tag, ct] = cipher.slice(PREFIX.length).split(":");
    const d = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  }
}

let kms: Kms | undefined;
export const getKms = (): Kms => (kms ??= new LocalKms());
export const isEncrypted = (v: unknown): v is string => typeof v === "string" && v.startsWith(PREFIX);
