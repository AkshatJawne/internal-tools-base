import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/kit/db";
import { audit, SYSTEM } from "@/kit/audit";
import { emit } from "@/kit/automation";
import { riskTier } from "./risk";
import { documentSvg } from "./documents";

export const vendorEventSchema = z.object({
  eventId: z.string().min(1),
  type: z.literal("verification.completed"),
  data: z.object({
    externalRef: z.string().min(1),
    applicant: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      country: z.string().length(2),
      ssn: z.string(),
      dob: z.string(),
    }),
    idScore: z.number().int().min(0).max(100),
    sanctionsHit: z.boolean(),
    pepHit: z.boolean(),
    documents: z.array(z.enum(["passport", "drivers_license", "selfie"])),
  }),
});
export type VendorEvent = z.infer<typeof vendorEventSchema>;

/** Idempotent by eventId: a redelivered webhook is acknowledged but not applied twice. */
export async function ingestVendorEvent(evt: VendorEvent, opts: { receivedAt?: Date } = {}) {
  try {
    await db.webhookEvent.create({ data: { eventId: evt.eventId, source: "kyc-vendor" } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { duplicate: true as const };
    throw e;
  }
  const { applicant, idScore, sanctionsHit, pepHit, externalRef } = evt.data;
  const tier = riskTier({ idScore, sanctionsHit, pepHit });
  const fields = { ...applicant, idScore, sanctionsHit, pepHit, riskTier: tier, vendorPayload: JSON.stringify({ idScore, sanctionsHit, pepHit, documents: evt.data.documents }) };
  const actor = SYSTEM("kyc-vendor");

  const existing = await db.kycCase.findUnique({ where: { externalRef } });
  let caseId: string;
  if (existing) {
    await db.kycCase.update({ where: { id: existing.id }, data: fields });
    caseId = existing.id;
    await audit({ actor, action: "kyc.case.updated", appId: "kyc", entityType: "KycCase", entityId: caseId, before: { riskTier: existing.riskTier, idScore: existing.idScore }, after: { riskTier: tier, idScore }, reason: `webhook ${evt.eventId}` });
  } else {
    const name = `${applicant.firstName} ${applicant.lastName}`;
    const created = await db.kycCase.create({
      data: {
        ...fields,
        externalRef,
        receivedAt: opts.receivedAt ?? new Date(),
        documents: { create: evt.data.documents.map((kind) => ({ kind, svg: documentSvg(kind, name, applicant.country, externalRef) })) },
      },
    });
    caseId = created.id;
    await audit({ actor, action: "kyc.case.received", appId: "kyc", entityType: "KycCase", entityId: caseId, after: { externalRef, riskTier: tier, idScore, sanctionsHit, pepHit }, reason: `webhook ${evt.eventId}` });
  }
  await emit("kyc.case.received", { appId: "kyc", entityType: "KycCase", entityId: caseId, data: { externalRef, riskTier: tier, sanctionsHit, pepHit, idScore, country: applicant.country } });
  return { duplicate: false as const, caseId };
}
