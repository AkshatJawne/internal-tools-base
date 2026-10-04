import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { audit, SYSTEM } from "@/kit/audit";
import { getSecretVersions } from "@/kit/secrets";
import { ingestVendorEvent, vendorEventSchema } from "@/apps/kyc/ingest";

// Machine-to-machine endpoint: authenticated by HMAC signature instead of a user session.
// Accepts the current key and (during rotation) the previous one, so keys can be rotated without a vendor outage.
function validSignature(body: string, sig: string | null) {
  if (!sig) return false;
  const a = Buffer.from(sig);
  return getSecretVersions("KYC_WEBHOOK_SECRET").some((key) => {
    const b = Buffer.from(createHmac("sha256", key).update(body).digest("hex"));
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-kyc-signature"))) {
    await audit({ actor: SYSTEM("kyc-vendor"), action: "webhook.rejected", appId: "kyc", entityType: "Webhook", entityId: "kyc-vendor", reason: "invalid signature" });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = vendorEventSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const result = await ingestVendorEvent(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
