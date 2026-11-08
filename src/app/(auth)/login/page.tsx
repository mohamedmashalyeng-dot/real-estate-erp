"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, BarChart3, Building2, Calculator, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@primeestates.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError("Invalid email or password. Please try again.");
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
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">EstateIQ</span>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Run every project, lead and installment from one place.
          </h2>
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
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden">
              <Building2 className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your organization workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            Demo: <span className="font-medium text-foreground">owner@primeestates.com</span> /{" "}
            <span className="font-medium text-foreground">Password123!</span>
          </div>
        </div>
      </main>
    </div>
  );
}
