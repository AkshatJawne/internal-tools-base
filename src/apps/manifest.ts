import type { Permission } from "@/kit/rbac";
import type { ConnectorId } from "@/kit/connectors/catalog";
import { db } from "@/kit/db";

// App catalog: every internal tool registers here. The sidebar, launcher, admin catalog, change requests and the
// connector data policy read this list. Behaviour of generated apps lives in ./definitions.ts (kept separate so
// the connector gateway, which reads the allowlist below, never imports app code).
export type AppManifest = {
  id: string;
  name: string;
  description: string;
  route: string;
  permission: Permission;
  kind: "custom" | "generated";
  owner: string;
  icon: string;
  connectors: ConnectorId[];
  /** Custom apps only: where their encrypted PII lives, so `revealPii` can serve it without app-specific code in the kit. */
  pii?: { entityType: string; fields: readonly string[]; read: (entityId: string) => Promise<Record<string, string | null> | null> };
};

export const APPS: AppManifest[] = [
  {
    id: "kyc",
    name: "KYC review queue",
    description: "Review identity verification cases from the KYC vendor with SLA tracking and four-eyes sign-off.",
    route: "/kyc",
    permission: "kyc.case.read",
    kind: "custom",
    owner: "Compliance Eng",
    icon: "🪪",
    connectors: ["kyc-vendor", "slack"],
    pii: {
      entityType: "KycCase",
      fields: ["ssn", "dob", "email"],
      read: (id) => db.kycCase.findUnique({ where: { id }, select: { ssn: true, dob: true, email: true } }),
    },
  },
  {
    id: "refunds",
    name: "Refunds",
    description: "Request refunds; amounts over the threshold need an approver before the payments API is called.",
    route: "/apps/refunds",
    permission: "refunds.read",
    kind: "generated",
    owner: "Payments Eng",
    icon: "💸",
    connectors: ["payments", "email", "slack"],
  },
  {
    id: "flags",
    name: "Feature flags",
    description: "Thin admin over the flag service. Production changes need approval.",
    route: "/apps/flags",
    permission: "flags.read",
    kind: "generated",
    owner: "Platform Eng",
    icon: "🚩",
    connectors: ["flags", "slack"],
  },
  {
    id: "vendors",
    name: "Vendor onboarding",
    description: "Approve new suppliers before Finance can pay them. Large contracts need a second approver.",
    route: "/apps/vendors",
    permission: "vendors.read",
    kind: "generated",
    owner: "Finance Ops",
    icon: "🏷️",
    connectors: ["slack"],
  },
];

export const getApp = (id: string) => APPS.find((a) => a.id === id);
