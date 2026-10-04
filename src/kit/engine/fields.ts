import { z } from "zod";
import type { AppDefinition, RecordData } from "./types";
import type { FieldDef, Settings } from "@/kit/settings";
import { maskValue, sealPii } from "@/kit/pii";
import { isEncrypted } from "@/kit/crypto";

export function getFields(def: AppDefinition, settings: Settings): FieldDef[] {
  return [...def.fields, ...(settings.customFields[def.appId] ?? []).map((f) => ({ ...f, custom: true }))];
}

export function optionsFor(f: FieldDef, settings: Settings): string[] {
  return f.optionsFrom ? settings[f.optionsFrom] : (f.options ?? []);
}

function fieldSchema(f: FieldDef, settings: Settings): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (f.type) {
    case "number":
      base = z.coerce.number();
      break;
    case "money":
      base = z.coerce.number().positive().multipleOf(0.01);
      break;
    case "email":
      base = z.string().trim().email();
      break;
    case "select": {
      const opts = optionsFor(f, settings);
      base = z.string().refine((v) => opts.includes(v), "Pick one of the options");
      break;
    }
    default:
      base = z.string().trim().min(1);
  }
  const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
  return z.preprocess(blankToUndefined, f.required ? base : base.optional());
}

export function parseForm(fields: FieldDef[], settings: Settings, formData: FormData) {
  const shape = Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f, settings)]));
  const raw = Object.fromEntries(fields.map((f) => [f.name, formData.get(f.name)]));
  const result = z.object(shape).safeParse(raw);
  if (result.success) return { data: result.data as RecordData };
  const issue = result.error.issues[0];
  const label = fields.find((f) => f.name === issue?.path[0])?.label ?? "Form";
  return { error: `${label}: ${issue?.message === "Required" ? "is required" : issue?.message}` };
}

const kindOf = (f: FieldDef) => (f.type === "email" ? "email" : "generic");
const maskKey = (name: string) => `${name}__mask`;

/** Encrypts PII fields before a record is stored, keeping a precomputed mask next to the ciphertext. */
export function seal(fields: FieldDef[], data: RecordData): RecordData {
  const out: RecordData = { ...data };
  for (const f of fields) {
    const v = out[f.name];
    if (!f.pii || v == null || v === "" || isEncrypted(v)) continue;
    const sealed = sealPii(String(v), kindOf(f));
    out[f.name] = sealed.cipher;
    out[maskKey(f.name)] = sealed.mask;
  }
  return out;
}

/** Masks PII before data is logged, emitted to automations or sent to the browser. Strips ciphertext and helper keys. */
export function redact(fields: FieldDef[], data: RecordData): RecordData {
  const out: RecordData = { ...data };
  for (const f of fields) {
    if (!f.pii || out[f.name] == null) continue;
    const v = String(out[f.name]);
    out[f.name] = (out[maskKey(f.name)] as string | undefined) ?? (isEncrypted(v) ? "••••••" : maskValue(v, kindOf(f)));
  }
  for (const k of Object.keys(out)) if (k.endsWith("__mask")) delete out[k];
  return out;
}
