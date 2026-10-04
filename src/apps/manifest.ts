import type { Permission } from "@/kit/rbac";
import type { ConnectorId } from "@/kit/connectors/catalog";

// App registry: every internal tool registers here. The sidebar, launcher, admin
// catalog and connector data policy all read from this list.
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
];

export const getApp = (id: string) => APPS.find((a) => a.id === id);
