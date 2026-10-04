import { getKms } from "@/kit/crypto";

export type PiiKind = "ssn" | "dob" | "email" | "generic";

export function maskValue(value: string | null | undefined, kind: PiiKind = "generic"): string {
  if (!value) return "—";
  switch (kind) {
    case "ssn":
      return `•••-••-${value.slice(-4)}`;
    case "dob":
      return "••/••/••••";
    case "email": {
      const [user, domain] = value.split("@");
      return `${user?.[0] ?? ""}•••@${domain ?? ""}`;
    }
    default:
      return value.length <= 4 ? "••••" : `${"•".repeat(Math.min(8, value.length - 2))}${value.slice(-2)}`;
  }
}

/** Encrypt a PII value for storage and precompute the mask shown to everyone who hasn't revealed it. */
export function sealPii(value: string, kind: PiiKind = "generic"): { cipher: string; mask: string } {
  return { cipher: getKms().encrypt(value), mask: maskValue(value, kind) };
}

/** Only revealPii() should call this; it enforces permission + reason and audits. */
export const unsealPii = (cipher: string): string => getKms().decrypt(cipher);
