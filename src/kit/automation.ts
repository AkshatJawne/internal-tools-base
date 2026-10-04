import { audit, SYSTEM } from "@/kit/audit";
import { notify } from "@/kit/connectors";
import { getSettings, type AutomationRule } from "@/kit/settings";

type Data = Record<string, unknown>;

function matches(rule: AutomationRule, data: Data) {
  if (!rule.condition) return true;
  const { field, op, value } = rule.condition;
  const actual = data[field];
  const n = Number(value);
  switch (op) {
    case "eq": return String(actual) === value;
    case "neq": return String(actual) !== value;
    case "gt": return Number(actual) > n;
    case "lt": return Number(actual) < n;
  }
}

const render = (template: string, data: Data) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(data[k] ?? ""));

/** Fire an event; ops-configured rules (Admin → Automations) decide what happens. */
export async function emit(event: string, ctx: { appId: string; entityType: string; entityId: string; data: Data }) {
  const { automationRules } = await getSettings();
  for (const rule of automationRules.filter((r) => r.enabled && r.event === event && matches(r, ctx.data))) {
    const message = render(rule.action.message, ctx.data);
    try {
      if (rule.action.connector === "slack") await notify.slack(ctx.appId, rule.action.target, message);
      else await notify.email(ctx.appId, rule.action.target, message);
      await audit({ actor: SYSTEM("automation"), action: "automation.run", appId: ctx.appId, entityType: ctx.entityType, entityId: ctx.entityId, after: { rule: rule.id, message } });
    } catch (err) {
      await audit({ actor: SYSTEM("automation"), action: "automation.failed", appId: ctx.appId, entityType: ctx.entityType, entityId: ctx.entityId, after: { rule: rule.id, error: String(err) } });
    }
  }
}
