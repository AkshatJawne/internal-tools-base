import type { ReactNode } from "react";

export type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple";

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "gray" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

/** Shared data table so every app looks and behaves the same. */
export function DataTable<T>({ columns, rows, rowKey, empty = "Nothing here yet" }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">{empty}</td></tr>
          )}
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-slate-50">
              {columns.map((c) => <td key={c.key} className={`px-3 py-2 align-top text-slate-700 ${c.className ?? ""}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50",
  secondary: "inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50",
  danger: "inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-500 disabled:opacity-50",
};
export const input = "block w-full rounded-lg border-0 px-2.5 py-1.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-500";
export const label = "block text-xs font-medium text-slate-600 mb-1";

export const fmtDate = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtMoney = (n: number, ccy = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(n);

export function timeUntil(d: Date) {
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  const abs = Math.abs(mins);
  const s = abs < 60 ? `${abs}m` : abs < 2880 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins < 0 ? `${s} overdue` : `${s} left`;
}
