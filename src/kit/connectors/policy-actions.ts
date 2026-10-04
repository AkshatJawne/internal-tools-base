"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { callConnector, DataPolicyError } from "@/kit/connectors";
import { CONNECTORS, type ConnectorId } from "@/kit/connectors/catalog";
import { errorMessage, type FormState } from "@/kit/action-state";
import { APPS } from "@/apps/manifest";

const schema = z.object({
  appId: z.string().refine((v) => v === "platform" || APPS.some((a) => a.id === v)),
  connector: z.string().refine((v): v is ConnectorId => v in CONNECTORS),
  dataClass: z.enum(["internal", "pii", "money"]),
});

/** Admin "DLP test": send a no-op probe through the gateway to prove what the policy allows or blocks. Logged either way. */
export async function probeConnectorPolicy(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("admin.read");
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: "Pick an app, connector and data class" };
    const { appId, connector, dataClass } = parsed.data;
    try {
      await callConnector({ appId, connector, operation: "policy.probe", request: { probe: true, by: user.name }, dataClass }, async () => ({ probe: "ok" }));
      await audit({ actor: user, action: "connector.probe", appId, entityType: "Connector", entityId: connector, after: { dataClass, result: "allowed" } });
      revalidatePath("/admin/connectors");
      return { ok: `Allowed: ${appId} → ${connector} with ${dataClass} data` };
    } catch (e) {
      revalidatePath("/admin/connectors");
      if (e instanceof DataPolicyError) return { error: `Blocked: ${e.message}` };
      throw e;
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
