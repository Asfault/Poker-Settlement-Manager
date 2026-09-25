"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import ConfirmDialog from "@/components/ConfirmDialog";
import HostTabBar from "@/components/host/HostTabBar";

const NAV = [
  { href: "/host", label: "Home" },
  { href: "/host/players", label: "Players" },
  { href: "/host/history", label: "History" },
  { href: "/host/stats", label: "Stats" },
  { href: "/host/display", label: "Display" },
  { href: "/host/shared", label: "Wild" },
];

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Client-side guard. The real security boundary is Supabase RLS —
  // this just keeps the UI from flashing protected screens.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace("/login");
      return;
    }
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
    setConfirmSignOut(false);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      {/* pt-safe clears the Dynamic Island — the status bar is translucent, so
          without it the logo row sits underneath the notch in the PWA. */}
      <header className="sticky top-0 z-30 bg-felt-900/95 backdrop-blur border-b border-white/5 pt-safe">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <Link
            href="/host"
            className="font-bold text-gold-400 shrink-0 min-h-[44px] flex items-center"
          >
            Pokeresh
          </Link>
          {/* Phones get the bottom tab bar instead — see HostTabBar. */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/host"
                  ? pathname === "/host"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
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
            onClick={() => setConfirmSignOut(true)}
            className="text-white/40 hover:text-loss text-sm shrink-0 min-h-[44px] px-2 -mr-2"
          >
            Sign out
          </button>
        </div>
      </header>

      {children}

      <HostTabBar />

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You'll need to log in again to get back into host mode."
        confirmLabel="Sign out"
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
