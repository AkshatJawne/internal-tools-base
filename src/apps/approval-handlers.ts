import type { ApprovalHandler } from "@/kit/approvals";
import { kycDecisionHandler } from "@/apps/kyc/handlers";

/** Approval kinds owned by custom apps. Generated apps and settings use the kit's handlers and need nothing here. */
export const APP_APPROVAL_HANDLERS: Record<string, ApprovalHandler> = {
  "kyc.decision": kycDecisionHandler,
};
