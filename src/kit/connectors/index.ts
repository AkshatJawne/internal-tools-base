import { randomBytes } from "crypto";
import { db } from "@/kit/db";
import { audit, SYSTEM } from "@/kit/audit";
import { getApp } from "@/apps/manifest";
import { CONNECTORS, PLATFORM_CONNECTORS, type ConnectorId, type DataClass } from "./catalog";

export class DataPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataPolicyError";
  }
}

export type GatewayCall = {
  appId: string;
  connector: ConnectorId;
  operation: string;
  request: unknown;
  /** What the payload contains. Defaults to internal; callers sending customer data or money must say so. */
  dataClass?: DataClass;
  idempotencyKey?: string;
};

/** Returns null if allowed, else the reason the policy blocks the call. */
export function policyViolation(c: Pick<GatewayCall, "appId" | "connector" | "dataClass">): string | null {
  const app = getApp(c.appId);
  const allowed: readonly ConnectorId[] = app ? app.connectors : c.appId === "platform" ? PLATFORM_CONNECTORS : [];
  if (!allowed.includes(c.connector)) return `app "${c.appId}" is not allowed to use connector "${c.connector}"`;
  const cls = c.dataClass ?? "internal";
  if (!(CONNECTORS[c.connector].accepts as readonly DataClass[]).includes(cls)) return `connector "${c.connector}" does not accept ${cls} data`;
  return null;
}

// All outbound integrations go through here. This is the data-policy (DLP) choke point:
// an app may only call connectors on its manifest allowlist, a connector only accepts the data
// classes it is cleared for, and every call (allowed or blocked) is logged. Adapters below are
// mocks; swap the body of each for the real SDK call. The Kubernetes NetworkPolicy in deploy/k8s
// makes the same boundary hold at the network layer.
export async function callConnector<T>(opts: GatewayCall, fn: () => Promise<T>): Promise<T> {
  const dataClass = opts.dataClass ?? "internal";
  const violation = policyViolation(opts);
  if (violation) {
    await db.connectorCall.create({
      data: { connector: opts.connector, operation: opts.operation, appId: opts.appId, status: "blocked", dataClass, policyReason: violation, request: dataClass === "internal" ? JSON.stringify(opts.request) : "[redacted]" },
    });
    await audit({ actor: SYSTEM("data-policy"), action: "connector.blocked", appId: opts.appId, entityType: "Connector", entityId: opts.connector, reason: violation });
    throw new DataPolicyError(`Data policy: ${violation}`);
  }
  if (opts.idempotencyKey) {
    const prior = await db.connectorCall.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (prior?.response) return JSON.parse(prior.response) as T;
  }
  const response = await fn();
  await db.connectorCall.create({
    data: {
      connector: opts.connector,
      operation: opts.operation,
      appId: opts.appId,
      status: "ok",
      dataClass,
      request: dataClass === "pii" ? "[redacted: pii]" : JSON.stringify(opts.request),
      response: JSON.stringify(response),
      idempotencyKey: opts.idempotencyKey,
    },
  });
  return response;
}

const id = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;

export const payments = {
  issueRefund: (appId: string, p: { refundId: string; transactionId: string; amount: number; currency: string }) =>
    callConnector(
      { appId, connector: "payments", operation: "refunds.create", request: p, dataClass: "money", idempotencyKey: `refund:${p.refundId}` },
      async () => ({ paymentRef: id("re"), status: "succeeded" as const }),
    ),
};

export const notify = {
  slack: (appId: string, channel: string, text: string) =>
    callConnector({ appId, connector: "slack", operation: "chat.postMessage", request: { channel, text } }, async () => ({ ts: id("msg") })),
  email: (appId: string, to: string, body: string) =>
    callConnector({ appId, connector: "email", operation: "send", request: { to, body }, dataClass: "pii" }, async () => ({ messageId: id("em") })),
};

export const flags = {
  set: (appId: string, p: { key: string; environment: string; enabled: boolean; rollout: number }) =>
    callConnector({ appId, connector: "flags", operation: "flags.update", request: p }, async () => ({ syncedAt: new Date().toISOString() })),
};

export const devin = {
  /** Mock: in production this POSTs to the Devin API (see docs/devin/automation.md). */
  openSession: (p: { changeRequestId: string; prompt: string }) =>
    callConnector({ appId: "platform", connector: "devin", operation: "sessions.create", request: { changeRequestId: p.changeRequestId, promptChars: p.prompt.length } }, async () => ({
      sessionId: id("devin"),
      url: `https://app.devin.ai/sessions/${randomBytes(16).toString("hex")}`,
    })),
};
