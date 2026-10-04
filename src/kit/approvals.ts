import type { ApprovalRequest, User } from "@prisma/client";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { can, ForbiddenError, type Permission } from "@/kit/rbac";

// Reusable maker-checker primitive (Power Automate "approvals" equivalent).
export type ApprovalHandler = {
  execute: (payload: Record<string, unknown>, ctx: { checker: User; approval: ApprovalRequest }) => Promise<void>;
  reject?: (payload: Record<string, unknown>, ctx: { checker: User; approval: ApprovalRequest }) => Promise<void>;
};

export async function requestApproval(input: {
  kind: string;
  appId: string;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
  maker: User;
  makerReason?: string | null;
  requiredPermission: Permission;
}) {
  const req = await db.approvalRequest.create({
    data: {
      kind: input.kind,
      appId: input.appId,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      payload: JSON.stringify(input.payload),
      makerId: input.maker.id,
      makerName: input.maker.name,
      makerReason: input.makerReason ?? null,
      requiredPermission: input.requiredPermission,
    },
  });
  await audit({
    actor: input.maker,
    action: "approval.requested",
    appId: input.appId,
    entityType: input.entityType,
    entityId: input.entityId,
    after: { approvalId: req.id, kind: input.kind, summary: input.summary, needs: input.requiredPermission },
    reason: input.makerReason,
  });
  return req;
}

/**
 * Rules: checker must differ from maker, must hold the required permission,
 * and the pending -> decided transition is atomic so the action runs exactly once.
 */
export async function decideApproval(input: {
  approvalId: string;
  checker: User;
  decision: "approve" | "reject";
  reason: string;
  handlers: Record<string, ApprovalHandler>;
}) {
  const { checker } = input;
  const req = await db.approvalRequest.findUnique({ where: { id: input.approvalId } });
  if (!req) throw new Error("Approval not found");
  if (req.status !== "pending") throw new Error(`This request is already ${req.status}`);
  if (req.makerId === checker.id) {
    await audit({ actor: checker, action: "access.denied", appId: req.appId, entityType: "ApprovalRequest", entityId: req.id, reason: "four-eyes: maker tried to approve own request" });
    throw new ForbiddenError("Four-eyes rule: you can't approve your own request");
  }
  if (!can(checker, req.requiredPermission as Permission)) throw new ForbiddenError(`Missing permission: ${req.requiredPermission}`);
  if (input.reason.trim().length < 3) throw new Error("A reason is required");

  const status = input.decision === "approve" ? "approved" : "rejected";
  const claimed = await db.approvalRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: { status, checkerId: checker.id, checkerName: checker.name, decisionReason: input.reason, decidedAt: new Date() },
  });
  if (claimed.count !== 1) throw new Error("Someone else already decided this request");

  await audit({
    actor: checker,
    action: `approval.${status}`,
    appId: req.appId,
    entityType: req.entityType,
    entityId: req.entityId,
    before: { status: "pending" },
    after: { approvalId: req.id, status, maker: req.makerName },
    reason: input.reason,
  });

  const handler = input.handlers[req.kind];
  if (!handler) throw new Error(`No handler for approval kind ${req.kind}`);
  const payload = JSON.parse(req.payload) as Record<string, unknown>;
  try {
    if (input.decision === "approve") {
      await handler.execute(payload, { checker, approval: req });
      await db.approvalRequest.updateMany({ where: { id: req.id, executedAt: null }, data: { executedAt: new Date() } });
    } else {
      await handler.reject?.(payload, { checker, approval: req });
    }
  } catch (e) {
    await db.approvalRequest.update({ where: { id: req.id }, data: { status: "failed" } });
    await audit({ actor: checker, action: "approval.failed", appId: req.appId, entityType: req.entityType, entityId: req.entityId, after: { error: String(e) } });
    throw e;
  }
}
