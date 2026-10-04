import { signIn } from "@/kit/auth/actions";
import { btn, input, label } from "@/kit/ui";

export const dynamic = "force-dynamic";

const DEMO = { email: "demo@acmepay.example", password: process.env.DEV_PASSWORD ?? "acmepay-demo" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const showDemo = (process.env.APP_ENV ?? "development") !== "production";

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-xs font-semibold text-white">A</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Acme Pay</div>
            <div className="text-[11px] text-ink-2">Internal tools</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">Use your Acme Pay account.</p>

        <form action={signIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required className={`${input} w-full`} />
          </div>
          <div>
            <label htmlFor="password" className={label}>Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className={`${input} w-full`} />
          </div>
          {error && <p className="text-sm text-red-600">That email and password did not match.</p>}
          <button className={`${btn.primary} w-full py-2`}>Sign in</button>
        </form>

        {showDemo && (
          <div className="mt-8 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-ink">Demo account</div>
                <div className="mt-1 font-mono text-xs text-ink-2">{DEMO.email}</div>
                <div className="font-mono text-xs text-ink-2">{DEMO.password}</div>
              </div>
              <form action={signIn}>
                <input type="hidden" name="email" value={DEMO.email} />
                <input type="hidden" name="password" value={DEMO.password} />
                <button className={btn.secondary}>Use it</button>
              </form>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-3">
          Development sign-in. In production this screen is the identity provider (Okta or Entra ID); roles come from directory groups and the rest of the platform is unchanged.
        </p>
      </div>
    </div>
  );
}
