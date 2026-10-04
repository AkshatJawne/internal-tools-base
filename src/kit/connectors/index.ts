import { randomBytes } from "crypto";
import { db } from "@/kit/db";
import { audit, SYSTEM } from "@/kit/audit";
import { getApp } from "@/apps/manifest";
import type { ConnectorId } from "./catalog";

// All outbound integrations go through here. This is the data-policy (DLP) choke point:
// an app may only call connectors listed in its manifest, and every call is logged.
// Adapters below are mocks; swap the body of each for the real SDK call.
async function callConnector<T>(
  opts: { appId: string; connector: ConnectorId; operation: string; request: unknown; idempotencyKey?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const app = getApp(opts.appId);
  if (!app?.connectors.includes(opts.connector)) {
    await db.connectorCall.create({
      data: { connector: opts.connector, operation: opts.operation, appId: opts.appId, status: "blocked", request: JSON.stringify(opts.request) },
    });
    await audit({ actor: SYSTEM("data-policy"), action: "connector.blocked", appId: opts.appId, entityType: "Connector", entityId: opts.connector });
    throw new Error(`Data policy: app "${opts.appId}" is not allowed to use connector "${opts.connector}"`);
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
      request: JSON.stringify(opts.request),
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
      { appId, connector: "payments", operation: "refunds.create", request: p, idempotencyKey: `refund:${p.refundId}` },
      async () => ({ paymentRef: id("re"), status: "succeeded" as const }),
    ),
};

export const notify = {
  slack: (appId: string, channel: string, text: string) =>
    callConnector({ appId, connector: "slack", operation: "chat.postMessage", request: { channel, text } }, async () => ({ ts: id("msg") })),
  email: (appId: string, to: string, body: string) =>
    callConnector({ appId, connector: "email", operation: "send", request: { to, body } }, async () => ({ messageId: id("em") })),
};

export const flags = {
  set: (appId: string, p: { key: string; environment: string; enabled: boolean; rollout: number }) =>
    callConnector({ appId, connector: "flags", operation: "flags.update", request: p }, async () => ({ syncedAt: new Date().toISOString() })),
};
