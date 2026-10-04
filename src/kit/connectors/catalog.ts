export const CONNECTORS = {
  "kyc-vendor": {
    name: "KYC vendor (Persona / Onfido style)",
    direction: "inbound",
    description: "HMAC-signed webhooks create and update KYC cases. Idempotent by event id.",
  },
  payments: {
    name: "Payments API (Stripe style)",
    direction: "outbound",
    description: "Issues refunds. Every call carries an idempotency key so a refund can never be paid twice.",
  },
  slack: { name: "Slack", direction: "outbound", description: "Posts notifications to channels." },
  email: { name: "Email (SES style)", direction: "outbound", description: "Sends notification emails." },
  flags: {
    name: "Feature flag service (Unleash / LaunchDarkly style)",
    direction: "outbound",
    description: "Pushes flag state to the flag service the product reads from.",
  },
} as const;

export type ConnectorId = keyof typeof CONNECTORS;
