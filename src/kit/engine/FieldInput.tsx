import type { FieldDef, Settings } from "@/kit/settings";
import { input, label } from "@/kit/ui";
import { optionsFor } from "./fields";

export function FieldInput({ f, settings }: { f: FieldDef; settings: Settings }) {
  const id = `f-${f.name}`;
  const common = { id, name: f.name, required: f.required, className: input };
  return (
    <div>
      <label htmlFor={id} className={label}>
        {f.label} {f.required && <span className="text-red-500">*</span>}
        {f.pii && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">PII</span>}
        {f.custom && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-700">added by ops</span>}
      </label>
      {f.type === "textarea" ? (
        <textarea rows={3} {...common} />
      ) : f.type === "select" ? (
        <select {...common} defaultValue="">
          <option value="" disabled={f.required}>Select…</option>
          {optionsFor(f, settings).map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={f.type === "money" || f.type === "number" ? "number" : f.type} step={f.type === "money" ? "0.01" : undefined} {...common} />
      )}
    </div>
  );
}
