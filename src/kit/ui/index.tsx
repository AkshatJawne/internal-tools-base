import type { ReactNode } from "react";

export type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple";

const DOT: Record<Tone, string> = {
  gray: "bg-zinc-400",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
  purple: "bg-violet-500",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line-2 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "gray" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-2xl font-medium tabular-nums tracking-tight ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

/** Shared data table so every app looks and behaves the same. */
export function DataTable<T>({ columns, rows, rowKey, empty = "Nothing here yet" }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 text-left text-xs font-medium text-ink-2">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-2">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-3">{empty}</td></tr>
          )}
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-canvas/60">
              {columns.map((c) => <td key={c.key} className={`px-4 py-2.5 align-top text-ink ${c.className ?? ""}`}>{c.render(r)}</td>)}
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
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50",
  secondary: "inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50",
  danger: "inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50",
};
export const input = "block rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none";
export const label = "block text-xs font-medium text-ink-2 mb-1";

export const fmtDate = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtMoney = (n: number, ccy = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(n);

export function timeUntil(d: Date) {
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  const abs = Math.abs(mins);
  const s = abs < 60 ? `${abs}m` : abs < 2880 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins < 0 ? `${s} overdue` : `${s} left`;
}
