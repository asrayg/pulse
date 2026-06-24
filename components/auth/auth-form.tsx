"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ email: isSignup ? "" : "demo@pulse.app", password: isSignup ? "" : "demo1234", name: "", company: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push("/home");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Card className="animate-fade-up shadow-2xl shadow-black/40">
      <CardHeader>
        <CardTitle className="text-base">{isSignup ? "Create your workspace" : "Welcome back"}</CardTitle>
        <CardDescription>{isSignup ? "Start asking your data anything in seconds." : "Sign in to continue to Pulse."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {isSignup && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={form.name} onChange={set("name")} placeholder="Jordan Operator" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company">Company / team</Label>
                <Input id="company" value={form.company} onChange={set("company")} placeholder="Acme Inc" required />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? <Spinner /> : isSignup ? "Create workspace" : "Sign in"}
          </Button>
        </form>
        {!isSignup && (
          <p className="mt-3 rounded-md border border-border bg-surface/60 px-3 py-2 text-[11px] text-muted-foreground">
            Demo account is pre-filled — just hit <span className="text-foreground">Sign in</span>.
          </p>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isSignup ? "Already have an account? " : "New to Pulse? "}
          <Link href={isSignup ? "/login" : "/signup"} className="text-primary hover:underline">
            {isSignup ? "Sign in" : "Create a workspace"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
