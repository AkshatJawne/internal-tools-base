// Posts 40 signed synthetic KYC vendor events (5 with sanctions/PEP hits), then
// replays 2 duplicates and 1 forged event to show idempotency and signature checks.
import { createHmac } from "crypto";
import { makeVendorEvent } from "../prisma/fixtures";

const URL = `${process.env.APP_URL ?? "http://localhost:3000"}/api/webhooks/kyc-vendor`;
const SECRET = process.env.KYC_WEBHOOK_SECRET ?? "dev-only-kyc-webhook-secret";
const HITS: Record<number, "sanctions" | "pep"> = { 3: "sanctions", 11: "pep", 19: "sanctions", 27: "pep", 35: "sanctions" };

async function send(body: string, sig = createHmac("sha256", SECRET).update(body).digest("hex")) {
  const res = await fetch(URL, { method: "POST", headers: { "content-type": "application/json", "x-kyc-signature": sig }, body });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text.slice(0, 120) };
  }
  return { status: res.status, json };
}

async function main() {
  const events = Array.from({ length: 40 }, (_, i) => JSON.stringify(makeVendorEvent(i, { hit: HITS[i] })));
  let created = 0;
  for (const e of events) if ((await send(e)).json.duplicate === false) created++;
  const dup1 = await send(events[0]);
  const dup2 = await send(events[1]);
  const forged = await send(events[2], "deadbeef");
  console.log(`Sent 40 events: ${created} applied.`);
  console.log(`Replayed 2 duplicates: ${[dup1, dup2].filter((r) => r.json.duplicate).length} ignored (idempotent).`);
  console.log(`Forged signature: HTTP ${forged.status}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
