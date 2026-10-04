import { defineApp } from "@/kit/engine/definition";

// Vendor onboarding: Finance Ops vets a new supplier before it can be paid.
// No connector effect: approval here is the control; payment setup happens in the ERP.
export const vendors = defineApp({
  appId: "vendors",
  titleField: "legalName",
  permissions: { read: "vendors.read", create: "vendors.create" },
  settings: {
    optionLists: { vendorCategories: ["Software", "Professional services", "Infrastructure", "Marketing", "Other"] },
    approvalThresholds: { vendorAnnualSpend: 50000 },
  },
  fields: [
    { name: "legalName", label: "Legal name", type: "text", required: true, inList: true },
    { name: "category", label: "Category", type: "select", optionsFrom: "vendorCategories", required: true, inList: true },
    { name: "country", label: "Country", type: "text", required: true, inList: true },
    { name: "annualSpend", label: "Expected annual spend (USD)", type: "money", required: true, inList: true },
    { name: "contactEmail", label: "Billing contact email", type: "email", required: true, pii: true },
    { name: "taxId", label: "Tax ID", type: "text", required: true, pii: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  statuses: {
    submitted: { label: "Submitted", tone: "blue" },
    approved: { label: "Approved", tone: "green" },
    rejected: { label: "Rejected", tone: "red" },
  },
  initialStatus: "submitted",
  actions: [
    {
      id: "approve",
      label: "Approve vendor",
      from: ["submitted"],
      to: "approved",
      permission: "vendors.review",
      tone: "primary",
      approval: {
        permission: "vendors.approve",
        when: (d, s) => Number(d.annualSpend) > s.approvalThresholds.vendorAnnualSpend,
        describe: (d) => `Onboard vendor ${d.legalName} (${d.category}, ~${d.annualSpend} USD/yr)`,
      },
    },
    { id: "reject", label: "Reject", from: ["submitted"], to: "rejected", permission: "vendors.review", tone: "danger", requireReason: true },
  ],
});
