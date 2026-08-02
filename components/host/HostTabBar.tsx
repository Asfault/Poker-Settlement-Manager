"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Phone-only bottom tab bar for host mode.
 *
 * Four destinations only — the ones you actually move between during a night.
 * Display and Wild live on the Home screen instead; neither is something you
 * reach for mid-game, and a fifth tab pushes each target under 44pt on a
 * small phone.
 *
 * Hidden at md and up, where the top nav in HostLayout takes over.
 */

type TabIconProps = { className?: string };

function HomeIcon({ className }: TabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function PlayersIcon({ className }: TabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1" />
    </svg>
  );
}

function HistoryIcon({ className }: TabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

function StatsIcon({ className }: TabIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 20V11" />
      <path d="M12 20V4" />
      <path d="M19 20v-6" />
    </svg>
  );
}

const TABS = [
  { href: "/host", label: "Home", Icon: HomeIcon },
  { href: "/host/players", label: "Players", Icon: PlayersIcon },
  { href: "/host/history", label: "History", Icon: HistoryIcon },
  { href: "/host/stats", label: "Stats", Icon: StatsIcon },
];

/**
 * Focused flows, not navigation destinations. Each already owns a fixed bottom
 * action bar ("Start session", "Save", "Done") and stacking tabs underneath
 * would both collide with it and invite you to wander off mid-task.
 */
const FLOW_ROUTES = ["/host/session", "/host/backfill"];

function isFlowRoute(pathname: string) {
  return FLOW_ROUTES.some((r) => pathname.startsWith(r));
}

export default function HostTabBar() {
  const pathname = usePathname();

  if (isFlowRoute(pathname)) return null;

  return (
    <>
      {/* In-flow spacer so page content can scroll clear of the fixed bar
          rather than every page hardcoding its own bottom padding. */}
      <div aria-hidden="true" className="md:hidden h-tabbar" />
      <nav
        aria-label="Host sections"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-felt-800/95 backdrop-blur border-t border-white/10 pb-safe"
      >
        <div className="flex">
          {TABS.map(({ href, label, Icon }) => {
            const active =
              href === "/host"
                ? pathname === "/host"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                // min-h-[56px] keeps the target comfortably over 44pt even
                // before the safe-area padding below it.
                className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-gold-400" : "text-white/45 active:text-white/70"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium leading-none">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
