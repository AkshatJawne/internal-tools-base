import { verifyAuditChain } from "../src/kit/audit-verify";
import { db } from "../src/kit/db";

verifyAuditChain()
  .then((r) => {
    if (r.ok) console.log(`audit chain OK: ${r.count} events, head ${r.head?.slice(0, 16) ?? "(empty)"}`);
    else {
      console.error(`audit chain BROKEN at seq ${r.brokenAt}: ${r.problem}`);
      process.exitCode = 1;
    }
  })
  .finally(() => db.$disconnect());
