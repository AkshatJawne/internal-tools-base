import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../src/kit/db";
import { audit, SYSTEM } from "../src/kit/audit";
import { requestApproval } from "../src/kit/approvals";
import { ingestVendorEvent } from "../src/apps/kyc/ingest";
import { makeVendorEvent } from "./fixtures";
import { seal } from "../src/kit/engine/fields";
import { refunds as refundsDef } from "../src/apps/refunds/definition";
import { vendors as vendorsDef } from "../src/apps/vendors/definition";

const USERS = [
  { id: "u_alice", name: "Alice Analyst", email: "alice@acmepay.example", role: "kyc_analyst", team: "Compliance" },
  { id: "u_ben", name: "Ben Analyst", email: "ben@acmepay.example", role: "kyc_analyst", team: "Compliance" },
  { id: "u_lena", name: "Lena Lead", email: "lena@acmepay.example", role: "kyc_lead", team: "Compliance" },
  { id: "u_omar", name: "Omar Ops", email: "omar@acmepay.example", role: "ops_agent", team: "Operations" },
  { id: "u_priya", name: "Priya Approver", email: "priya@acmepay.example", role: "ops_approver", team: "Operations" },
  { id: "u_adam", name: "Adam Admin", email: "adam@acmepay.example", role: "ops_admin", team: "Platform" },
  { id: "u_aud", name: "Audrey Auditor", email: "audrey@acmepay.example", role: "auditor", team: "Internal Audit" },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function main() {
  for (const sql of readFileSync(join(__dirname, "audit-triggers.sql"), "utf8").split(/;\s*\n(?=CREATE)/)) {
    await db.$executeRawUnsafe(sql.trim().replace(/;$/, "") + ";");
  }
  for (const u of USERS) await db.user.create({ data: u });
  await audit({ actor: SYSTEM("seed"), action: "platform.seeded", entityType: "Platform", entityId: "seed" });

  // KYC: a spread of ages so SLA badges show green, amber and red.
  const ages = [1, 2, 3, 3.5, 5, 6, 10, 20, 22, 30, 48, 60, 70, 0.5];
  for (let i = 0; i < ages.length; i++) {
    await ingestVendorEvent(makeVendorEvent(i, { prefix: "seed", hit: i === 4 ? "sanctions" : i === 9 ? "pep" : undefined }), { receivedAt: hoursAgo(ages[i]) });
  }
  const ben = await db.user.findUniqueOrThrow({ where: { id: "u_ben" } });
  const two = await db.kycCase.findMany({ where: { status: "new", riskTier: { not: "high" } }, take: 2 });
  for (const c of two) await db.kycCase.update({ where: { id: c.id }, data: { assigneeId: ben.id, status: "in_review" } });

  // Refunds
  const omar = await db.user.findUniqueOrThrow({ where: { id: "u_omar" } });
  const refunds = [
    { customerName: "Maya Chen", customerEmail: "maya.chen@example.com", transactionId: "txn_8F2K1", amount: 42.5, currency: "USD", reasonCode: "Duplicate charge", status: "issued", paymentRef: "re_seed01" },
    { customerName: "Jonas Weber", customerEmail: "jonas.w@example.com", transactionId: "txn_3H9QZ", amount: 129, currency: "EUR", reasonCode: "Service not delivered", status: "requested" },
    { customerName: "Ade Okafor", customerEmail: "ade.okafor@example.com", transactionId: "txn_7LM20", amount: 1850, currency: "USD", reasonCode: "Fraud / unauthorized", status: "pending_approval" },
    { customerName: "Sofia Rossi", customerEmail: "sofia.r@example.com", transactionId: "txn_1PX77", amount: 15, currency: "GBP", reasonCode: "Goodwill credit", status: "rejected" },
  ];
  for (const { status, ...data } of refunds) {
    const rec = await db.record.create({ data: { appId: "refunds", status, data: JSON.stringify(seal(refundsDef.fields, data)), createdBy: omar.name } });
    await audit({ actor: omar, action: "record.create", appId: "refunds", entityType: "Record", entityId: rec.id, after: { status } });
    if (status === "pending_approval") {
      await requestApproval({
        kind: "engine.action", appId: "refunds", entityType: "Record", entityId: rec.id,
        summary: `Refund ${data.amount} ${data.currency} to ${data.customerName} (txn ${data.transactionId})`,
        payload: { appId: "refunds", recordId: rec.id, actionId: "issue", previousStatus: "requested" },
        maker: omar, makerReason: "Customer confirmed card was stolen", requiredPermission: "refunds.approve",
      });
    }
  }

  // Feature flags
  const flags = [
    { key: "new-onboarding-flow", environment: "staging", rollout: 100, owner: "Growth", description: "Redesigned signup", status: "on" },
    { key: "new-onboarding-flow", environment: "production", rollout: 10, owner: "Growth", description: "Redesigned signup", status: "off" },
    { key: "instant-payouts", environment: "production", rollout: 100, owner: "Payments", description: "Same-day payouts for verified merchants", status: "on" },
    { key: "kyc-vendor-v2", environment: "staging", rollout: 50, owner: "Compliance Eng", description: "Route 50% of checks to the new vendor API", status: "off" },
  ];
  for (const { status, ...data } of flags) {
    await db.record.create({ data: { appId: "flags", status, data: JSON.stringify(data), createdBy: "Platform Eng" } });
  }
  // Vendor onboarding: one small vendor waiting for review, one large one already waiting for a second approver.
  const vendors = [
    { legalName: "Northwind Cloud Ltd", category: "Infrastructure", country: "GB", annualSpend: 18000, contactEmail: "billing@northwind.example", taxId: "GB123456789", status: "submitted" },
    { legalName: "Acme Consulting LLP", category: "Professional services", country: "US", annualSpend: 240000, contactEmail: "ap@acme-consulting.example", taxId: "12-3456789", status: "pending_approval" },
  ];
  for (const { status, ...data } of vendors) {
    const rec = await db.record.create({ data: { appId: "vendors", status, data: JSON.stringify(seal(vendorsDef.fields, data)), createdBy: omar.name } });
    await audit({ actor: omar, action: "record.create", appId: "vendors", entityType: "Record", entityId: rec.id, after: { status } });
    if (status === "pending_approval") {
      await requestApproval({
        kind: "engine.action", appId: "vendors", entityType: "Record", entityId: rec.id,
        summary: `Onboard vendor ${data.legalName} (${data.category}, ~${data.annualSpend} USD/yr)`,
        payload: { appId: "vendors", recordId: rec.id, actionId: "approve", previousStatus: "submitted" },
        maker: omar, makerReason: "MSA signed, security questionnaire passed", requiredPermission: "vendors.approve",
      });
    }
  }
  console.log("Seeded users, settings defaults, 14 KYC cases, refunds, flags and vendors.");
  // Change requests (tier-2 self-service): one open, one with a PR + preview waiting on the requester.
  const cr1 = await db.changeRequest.create({
    data: { requesterId: omar.id, requesterName: omar.name, appId: "refunds", title: "Show the customer's previous refunds on the refund page", description: "When I review a refund I open the payments console to check for repeat refunds on the same customer. Show the last 3 refunds (date, amount, status) for the same customer email on the refund detail page so I can spot abuse without leaving the app.", classification: "logic", urgency: "normal" },
  });
  await audit({ actor: omar, action: "change_request.created", appId: "refunds", entityType: "ChangeRequest", entityId: cr1.id, after: { title: cr1.title, classification: "logic", urgency: "normal" } });
  const cr2 = await db.changeRequest.create({
    data: { requesterId: ben.id, requesterName: ben.name, appId: "kyc", title: "Add a 'documents expired' reason code and show document expiry dates", description: "Analysts reject cases with expired IDs under 'Identity mismatch', which skews our reject-reason reporting. Add a reject reason code 'Document expired' and show each document's expiry date next to the thumbnail.", classification: "ui", urgency: "low", status: "preview_ready", prUrl: "https://github.com/AkshatJawne/internal-tools-base/pull/1", previewUrl: "https://preview.example.com/cr-seed" },
  });
  await audit({ actor: ben, action: "change_request.created", appId: "kyc", entityType: "ChangeRequest", entityId: cr2.id, after: { title: cr2.title, classification: "ui", urgency: "low" } });
  await audit({ actor: SYSTEM("devin"), action: "change_request.pr_open", appId: "kyc", entityType: "ChangeRequest", entityId: cr2.id, before: { status: "dispatched" }, after: { status: "pr_open", prUrl: cr2.prUrl } });
  await audit({ actor: SYSTEM("ci"), action: "change_request.preview_ready", appId: "kyc", entityType: "ChangeRequest", entityId: cr2.id, before: { status: "pr_open" }, after: { status: "preview_ready", previewUrl: cr2.previewUrl } });

}

main().finally(() => db.$disconnect());
