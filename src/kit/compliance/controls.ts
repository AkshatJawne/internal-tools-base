/**
 * Maps audit actions to the controls an auditor asks about. The evidence pack for a control is
 * "every event matching these actions in the period, plus chain integrity and the role matrix".
 * Power Apps equivalent: Purview audit search + a screenshot of the admin center. Here it is one JSON file from one chain.
 */
export type Control = {
  id: string;
  framework: "SOC 2" | "PCI DSS" | "GLBA/GDPR";
  title: string;
  question: string;
  actions: string[]; // exact action names, or prefix ending in "*"
};

export const CONTROLS: Control[] = [
  { id: "CC6.1", framework: "SOC 2", title: "Logical access", question: "Who can do what, and were denials enforced?", actions: ["access.denied", "auth.sign_in", "auth.sign_out", "user.role_changed"] },
  { id: "CC6.3", framework: "SOC 2", title: "Segregation of duties", question: "Did a second person approve money, regulated decisions and threshold changes?", actions: ["approval.*"] },
  { id: "CC7.2", framework: "SOC 2", title: "Monitoring of anomalies", question: "Were policy violations and tampering attempts detected and logged?", actions: ["connector.blocked", "webhook.rejected", "automation.failed", "approval.failed"] },
  { id: "CC8.1", framework: "SOC 2", title: "Change management", question: "Were production-affecting changes requested, reviewed and approved before taking effect?", actions: ["settings.update", "change_request.*", "automation.rule.*"] },
  { id: "10.2", framework: "PCI DSS", title: "Audit trail of actions on cardholder-adjacent systems", question: "Is every refund (money movement) attributable to a person with before/after state?", actions: ["record.issue", "record.reject", "record.create", "record.approval_rejected"] },
  { id: "Art. 32", framework: "GLBA/GDPR", title: "Access to personal data", question: "Who looked at unmasked PII, when, and why?", actions: ["pii.reveal", "kyc.*"] },
];

export function matchesControl(control: Control, action: string): boolean {
  return control.actions.some((a) => (a.endsWith("*") ? action.startsWith(a.slice(0, -1)) : action === a));
}

/** Prisma `where` fragment for a control's actions. */
export function controlWhere(control: Control) {
  return { OR: control.actions.map((a) => (a.endsWith("*") ? { action: { startsWith: a.slice(0, -1) } } : { action: a })) };
}
