"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, BarChart3, Building2, Calculator, Eye, EyeOff, LockKeyhole, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

// The seeded demo account only exists in development databases.
const DEMO_LOGIN = process.env.NODE_ENV === "production" ? null : { email: "owner@primeestates.com", password: "Password123!" };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_LOGIN?.email ?? "");
  const [password, setPassword] = useState(DEMO_LOGIN?.password ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.code === "rate_limited" ? "Too many sign-in attempts. Please wait 15 minutes and try again." : "Check your email and password, then try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-1/4 size-[500px] rounded-full border border-white/8" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-1/3 size-[320px] rounded-full border border-white/8" />
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">EstateIQ</span>
        </div>

        <div className="login-enter relative max-w-lg space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80"><span className="size-1.5 rounded-full bg-emerald-300" />A little less busywork. A lot more clarity.</span>
          <h2 className="text-4xl font-semibold leading-[1.15] tracking-[-0.04em] xl:text-5xl">
            Your next chapter.<br /><span className="text-blue-200">All in one place.</span>
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-white/65">Move from first conversation to final payment with a workspace that keeps everything connected.</p>
          <ul className="space-y-3.5 text-sm text-white/80">
            {[
              { icon: Users, text: "CRM pipeline synced with your lead sheets" },
              { icon: Calculator, text: "Payment plans and handover checks in seconds" },
              { icon: Banknote, text: "Collections, arrears aging and customer statements" },
              { icon: BarChart3, text: "Sales, marketing ROI and team performance reports" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">© {new Date().getFullYear()} EstateIQ · Real Estate ERP</p>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="login-enter w-full max-w-md rounded-3xl border border-border/70 bg-card p-7 shadow-raised sm:p-10">
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden">
              <Building2 className="size-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your workspace awaits</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Welcome back<span className="text-primary">.</span></h1>
            <p className="text-sm text-muted-foreground">A good day starts with everything in view.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={loading}>
            {error ? (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/8 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                name="email"
                maxLength={191}
                disabled={loading}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative"><Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pr-12"
              /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></div>
            </div>

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl" loading={loading}>
              <span>{loading ? "Signing you in…" : "Continue to workspace"}</span>{!loading ? <ArrowRight className="size-4" /> : null}
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />Access is limited to your organization’s members.</div>

          {DEMO_LOGIN ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              Demo: <span className="font-medium text-foreground">{DEMO_LOGIN.email}</span> /{" "}
              <span className="font-medium text-foreground">{DEMO_LOGIN.password}</span>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
