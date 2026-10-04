/** What a payload may contain. The gateway refuses a call whose class the connector doesn't accept. */
export type DataClass = "internal" | "pii" | "money";

export const CONNECTORS = {
  "kyc-vendor": {
    name: "KYC vendor (Persona / Onfido style)",
    direction: "inbound",
    classification: "vendor-pii",
    accepts: ["internal", "pii"],
    description: "HMAC-signed webhooks create and update KYC cases. Idempotent by event id; two active keys for rotation.",
  },
  payments: {
    name: "Payments API (Stripe style)",
    direction: "outbound",
    classification: "vendor-money",
    accepts: ["internal", "money"],
    description: "Issues refunds. Every call carries an idempotency key so a refund can never be paid twice.",
  },
  slack: {
    name: "Slack",
    direction: "outbound",
    classification: "notification",
    accepts: ["internal"],
    description: "Posts notifications to channels. Never accepts PII or money payloads.",
  },
  email: {
    name: "Email (SES style)",
    direction: "outbound",
    classification: "notification",
    accepts: ["internal", "pii"],
    description: "Sends notification emails to customers and staff (addresses are PII).",
  },
  flags: {
    name: "Feature flag service (Unleash / LaunchDarkly style)",
    direction: "outbound",
    classification: "internal",
    accepts: ["internal"],
    description: "Pushes flag state to the flag service the product reads from.",
  },
  devin: {
    name: "Devin (engineering agent)",
    direction: "outbound",
    classification: "internal",
    accepts: ["internal"],
    description: "Opens a session from an ops change request. Receives the request text and repo pointers only — never customer data or credentials.",
  },
} as const satisfies Record<string, { name: string; direction: "inbound" | "outbound"; classification: string; accepts: readonly DataClass[]; description: string }>;

export type ConnectorId = keyof typeof CONNECTORS;

/** Connectors the platform itself (not an app) may call. */
export const PLATFORM_CONNECTORS: ConnectorId[] = ["devin", "slack", "email"];
