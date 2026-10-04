import { defineApp } from "@/kit/engine/definition";
import { payments } from "@/kit/connectors";

export const refunds = defineApp({
  appId: "refunds",
  titleField: "customerName",
  permissions: { read: "refunds.read", create: "refunds.create" },
  settings: {
    optionLists: { refundReasons: ["Duplicate charge", "Service not delivered", "Fraud / unauthorized", "Goodwill credit"] },
    approvalThresholds: { refundAmount: 500 },
  },
  fields: [
    { name: "customerName", label: "Customer name", type: "text", required: true, inList: true },
    { name: "customerEmail", label: "Customer email", type: "email", required: true, pii: true, inList: true },
    { name: "transactionId", label: "Transaction ID", type: "text", required: true, inList: true },
    { name: "amount", label: "Amount", type: "money", required: true, inList: true },
    { name: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "GBP"], required: true, inList: true },
    { name: "reasonCode", label: "Reason", type: "select", optionsFrom: "refundReasons", required: true, inList: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  statuses: {
    requested: { label: "Requested", tone: "blue" },
    issued: { label: "Issued", tone: "green" },
    rejected: { label: "Rejected", tone: "red" },
  },
  initialStatus: "requested",
  actions: [
    {
      id: "issue",
      label: "Issue refund",
      from: ["requested"],
      to: "issued",
      permission: "refunds.create",
      tone: "primary",
      approval: {
        permission: "refunds.approve",
        when: (d, s) => Number(d.amount) > s.approvalThresholds.refundAmount,
        describe: (d) => `Refund ${d.amount} ${d.currency} to ${d.customerName} (txn ${d.transactionId})`,
      },
      effect: async ({ appId, recordId, data }) => {
        const res = await payments.issueRefund(appId, {
          refundId: recordId,
          transactionId: String(data.transactionId),
          amount: Number(data.amount),
          currency: String(data.currency),
        });
        return { paymentRef: res.paymentRef };
      },
    },
    { id: "reject", label: "Reject", from: ["requested"], to: "rejected", permission: "refunds.approve", tone: "danger", requireReason: true },
  ],
});
