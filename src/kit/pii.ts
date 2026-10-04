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
