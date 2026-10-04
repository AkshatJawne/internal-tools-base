import { faker } from "@faker-js/faker";
import type { VendorEvent } from "../src/apps/kyc/ingest";

const COUNTRIES = ["US", "GB", "DE", "CA", "FR", "NG", "BR", "IN"];

/** Synthetic KYC vendor event. `hit` forces a sanctions or PEP match. */
export function makeVendorEvent(i: number, opts: { hit?: "sanctions" | "pep"; prefix?: string } = {}): VendorEvent {
  faker.seed(1000 + i + (opts.prefix?.length ?? 0) * 7919);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    eventId: `evt_${opts.prefix ?? "w"}_${i}`,
    type: "verification.completed",
    data: {
      externalRef: `KYC-${opts.prefix === "seed" ? "1" : "2"}${String(i).padStart(4, "0")}`,
      applicant: {
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName, provider: "example.com" }).toLowerCase(),
        country: faker.helpers.arrayElement(COUNTRIES),
        ssn: faker.helpers.replaceSymbols("###-##-####"),
        dob: faker.date.birthdate({ min: 18, max: 80, mode: "age" }).toISOString().slice(0, 10),
      },
      idScore: opts.hit ? faker.number.int({ min: 55, max: 95 }) : faker.number.int({ min: 35, max: 99 }),
      sanctionsHit: opts.hit === "sanctions",
      pepHit: opts.hit === "pep",
      documents: faker.helpers.arrayElement([["passport", "selfie"], ["drivers_license", "selfie"], ["passport"]]) as VendorEvent["data"]["documents"],
    },
  };
}
