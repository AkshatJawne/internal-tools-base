import { DEFINITIONS } from "./definitions";
import { getApp } from "./manifest";

/** Events that automation rules can listen to. Generated apps contribute theirs automatically. */
export const EVENTS: { id: string; label: string; fields: string[] }[] = [
  { id: "kyc.case.received", label: "KYC: case received from vendor", fields: ["riskTier", "sanctionsHit", "pepHit", "idScore", "country", "externalRef"] },
  { id: "kyc.case.decided", label: "KYC: case decided", fields: ["decision", "riskTier", "externalRef"] },
  ...Object.values(DEFINITIONS).flatMap((def) => {
    const name = getApp(def.appId)?.name ?? def.appId;
    const fields = def.fields.map((f) => f.name);
    return [
      { id: `${def.appId}.created`, label: `${name}: record created`, fields },
      ...def.actions.map((a) => ({ id: `${def.appId}.${a.id}`, label: `${name}: ${a.label}`, fields })),
    ];
  }),
];
