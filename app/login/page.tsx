"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Already signed in? Skip straight to the dashboard.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/host");
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace("/host");
  }

  if (checking) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🂡</div>
          <h1 className="text-2xl font-bold">Host Login</h1>
          <p className="text-white/50 text-sm mt-1">Pokeresh</p>
        </div>

        {!isSupabaseConfigured ? (
          <Card className="p-5">
            <p className="text-loss text-sm">
              Supabase isn&apos;t configured. Add{" "}
              <code className="text-white/80">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="text-white/80">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              </code>{" "}
              to your environment variables.
            </p>
          </Card>
        ) : (
          <Card className="p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm text-white/70 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-loss text-xs">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full mt-1"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Card>
        )}

        <button
          onClick={() => router.push("/")}
          className="w-full text-center text-white/40 hover:text-white/70 text-sm mt-5"
        >
          ← Back to app
        </button>
      </div>
    </div>
  );
}
