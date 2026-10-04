import { NextResponse } from "next/server";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { ForbiddenError, PERMISSIONS, ROLES } from "@/kit/rbac";
import { verifyAuditChain } from "@/kit/audit-verify";
import { CONTROLS, controlWhere } from "@/kit/compliance/controls";

/** Evidence pack for one control: a self-describing JSON an auditor can sample. Download is itself audited. */
export async function GET(_req: Request, { params }: { params: Promise<{ control: string }> }) {
  try {
    const user = await requirePermission("audit.read");
    const { control: id } = await params;
    const control = CONTROLS.find((c) => c.id === decodeURIComponent(id));
    if (!control) return NextResponse.json({ error: "unknown control" }, { status: 404 });
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [events, integrity] = await Promise.all([
      db.auditEvent.findMany({ where: { ...controlWhere(control), at: { gte: since } }, orderBy: { seq: "asc" } }),
      verifyAuditChain(),
    ]);
    await audit({ actor: user, action: "evidence.exported", entityType: "Control", entityId: control.id, after: { events: events.length, chainOk: integrity.ok } });
    const pack = {
      control,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      period: { from: since.toISOString(), to: new Date().toISOString() },
      chainIntegrity: integrity,
      roleMatrix: Object.fromEntries(Object.entries(ROLES).map(([r, v]) => [r, v.permissions])),
      permissions: PERMISSIONS,
      events: events.map((e) => ({ ...e, before: e.before && JSON.parse(e.before), after: e.after && JSON.parse(e.after) })),
    };
    return new NextResponse(JSON.stringify(pack, null, 2), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="evidence-${control.id.replace(/[^A-Za-z0-9.]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json"` },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
