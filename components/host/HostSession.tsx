"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoadedSession,
  loadSession,
  setSessionStatus,
} from "@/lib/db/sessions";
import Card from "@/components/Card";
import Button from "@/components/Button";
import HostLiveSession from "./HostLiveSession";
import HostTally from "./HostTally";
import HostResults from "./HostResults";

export default function HostSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LoadedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadSession(sessionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function goTo(status: "live" | "tally" | "complete") {
    await setSessionStatus(sessionId, status);
    await refresh();
  }

  if (loading) {
    return <div className="px-4 py-16 text-center text-white/40 text-sm">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6 text-center">
            <p className="text-loss text-sm mb-4">
              {error ?? "Session not found"}
            </p>
            <Button onClick={() => router.push("/host")}>Back to host</Button>
          </Card>
        </div>
      </div>
    );
  }

  switch (data.session.status) {
    case "tally":
      return (
        <HostTally
          data={data}
          onRefresh={refresh}
          onBack={() => goTo("live")}
          onCalculate={() => goTo("complete")}
        />
      );
    case "complete":
      return <HostResults data={data} onReopen={() => goTo("tally")} />;
    default:
      return (
        <HostLiveSession
          data={data}
          onRefresh={refresh}
          onSessionOver={() => goTo("tally")}
        />
      );
  }
}
