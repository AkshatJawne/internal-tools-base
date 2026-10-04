// Single source of truth for security roles (the Power Apps "security role" equivalent).
// Deny by default: a permission is only granted if listed here.
export const PERMISSIONS = {
  "kyc.case.read": "View KYC cases",
  "kyc.case.claim": "Take the next case from the queue",
  "kyc.case.decide": "Approve, reject or escalate a case",
  "kyc.case.reassign": "Reassign cases to another analyst",
  "kyc.case.signoff": "Sign off a decision made by someone else (four-eyes)",
  "pii.reveal": "Reveal masked PII with a recorded reason",
  "refunds.read": "View refunds",
  "refunds.create": "Request and issue refunds",
  "refunds.approve": "Approve refunds above the threshold",
  "flags.read": "View feature flags",
  "flags.toggle": "Request flag changes",
  "flags.approve_prod": "Approve production flag changes",
  "approvals.read": "Open the approvals inbox",
  "audit.read": "Read the audit log",
  "settings.read": "View platform settings",
  "settings.write": "Change platform settings, forms and automations",
  "settings.approve": "Approve sensitive settings changes",
  "admin.read": "View the admin center",
  "users.manage": "Assign security roles",
  "requests.create": "File a change request for engineering / Devin",
  "requests.manage": "Triage change requests and dispatch them to Devin",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES = {
  kyc_analyst: {
    label: "KYC analyst",
    permissions: ["kyc.case.read", "kyc.case.claim", "kyc.case.decide", "pii.reveal", "approvals.read", "requests.create"],
  },
  kyc_lead: {
    label: "KYC lead",
    permissions: [
      "kyc.case.read", "kyc.case.claim", "kyc.case.decide", "kyc.case.reassign", "kyc.case.signoff",
      "pii.reveal", "approvals.read", "audit.read", "requests.create",
    ],
  },
  ops_agent: {
    label: "Ops agent",
    permissions: ["refunds.read", "refunds.create", "flags.read", "flags.toggle", "pii.reveal", "approvals.read", "requests.create"],
  },
  ops_approver: {
    label: "Ops approver",
    permissions: [
      "refunds.read", "refunds.approve", "flags.read", "flags.approve_prod", "settings.read",
      "settings.approve", "pii.reveal", "approvals.read", "requests.create",
    ],
  },
  ops_admin: {
    label: "Ops admin",
    permissions: [
      "settings.read", "settings.write", "admin.read", "users.manage", "audit.read",
      "refunds.read", "flags.read", "approvals.read", "requests.create", "requests.manage",
    ],
  },
  auditor: {
    label: "Auditor (read-only)",
    permissions: ["audit.read", "admin.read", "settings.read", "kyc.case.read", "refunds.read", "flags.read"],
  },
} as const satisfies Record<string, { label: string; permissions: readonly Permission[] }>;

export type Role = keyof typeof ROLES;

export function can(user: { role: string } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const role = ROLES[user.role as Role];
  return !!role && (role.permissions as readonly Permission[]).includes(permission);
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
