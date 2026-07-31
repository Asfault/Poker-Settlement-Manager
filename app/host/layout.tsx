"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/host", label: "Home" },
  { href: "/host/players", label: "Players" },
  { href: "/host/history", label: "History" },
  { href: "/host/stats", label: "Stats" },
];

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  // Client-side guard. The real security boundary is Supabase RLS —
  // this just keeps the UI from flashing protected screens.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) router.replace("/login");
      else setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-felt-900/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/host" className="font-bold text-gold-400 shrink-0">
            Pokeresh
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active =
                item.href === "/host"
                  ? pathname === "/host"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-white/10 text-white font-semibold"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={signOut}
            className="text-white/40 hover:text-loss text-sm shrink-0"
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
