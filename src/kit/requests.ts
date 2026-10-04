import { APPS } from "@/apps/manifest";

export const CLASSIFICATIONS = {
  ui: { label: "Screen / copy / layout", reviewers: ["@AkshatJawne"], note: "One engineer reviews. Preview deploy is usually enough for the requester to confirm." },
  logic: { label: "Business rule / workflow", reviewers: ["@AkshatJawne", "app owner"], note: "App owner reviews. Must come with a test of the rule." },
  money_pii: { label: "Touches money, PII or permissions", reviewers: ["@AkshatJawne", "security"], note: "Two reviewers incl. security. Devin may not weaken maker-checker, masking or RBAC; CI gates enforce it." },
} as const;
export type Classification = keyof typeof CLASSIFICATIONS;

export const REQUEST_STATUSES: Record<string, { label: string; tone: "gray" | "blue" | "amber" | "green" | "red" | "purple" }> = {
  open: { label: "Open", tone: "gray" },
  dispatched: { label: "Devin working", tone: "purple" },
  pr_open: { label: "PR open", tone: "blue" },
  preview_ready: { label: "Preview ready", tone: "amber" },
  approved: { label: "Approved by requester", tone: "green" },
  deployed: { label: "Deployed", tone: "green" },
  declined: { label: "Declined", tone: "red" },
};

/**
 * The prompt Devin receives. It carries the ask, the repo conventions and the guardrails, never
 * customer data or credentials. Keeping it in code (not a Slack message) means the policy is reviewable.
 */
export function buildDevinPrompt(r: { id: string; appId: string; title: string; description: string; classification: string; requesterName: string }) {
  const app = APPS.find((a) => a.id === r.appId);
  const cls = CLASSIFICATIONS[r.classification as Classification] ?? CLASSIFICATIONS.logic;
  return [
    `Change request ${r.id} from ${r.requesterName} (ops) for app "${app?.name ?? r.appId}" (${r.appId}).`,
    ``,
    `## Ask`,
    `${r.title}`,
    ``,
    r.description,
    ``,
    `## How to work`,
    `- Repo: AkshatJawne/internal-tools-base. Read .agents/skills/internal-tools-conventions/SKILL.md first; use .agents/skills/new-internal-app if this is a new app.`,
    `- Prefer changing the app definition (src/apps/${r.appId}/definition.ts) or settings over new code. Add custom code only where the definition cannot express it.`,
    `- Open ONE pull request on a branch named devin/cr-${r.id}. Do not push to main. Do not merge.`,
    `- Classification: ${cls.label}. Required reviewers: ${cls.reviewers.join(", ")}. ${cls.note}`,
    `- Run pnpm lint, pnpm typecheck, pnpm lint:platform and pnpm build before opening the PR; include screenshots as the requester's role.`,
    `- Guardrails (CI enforces these, do not work around them): every action keeps requirePermission; every mutation audits; money / regulated / threshold changes go through requestApproval; PII stays pii:true and encrypted; connectors only via callConnector; synthetic data only.`,
    `- You have no production credentials and must not add any. If the ask needs a secret or infra change, describe it in the PR instead.`,
    `- Budget: stop and report if the change exceeds ~2 hours of work; it probably needs an engineer to re-scope.`,
    `- When the PR is open, comment with the preview URL and a 3-line summary written for ${r.requesterName}, not for engineers.`,
  ].join("\n");
}
