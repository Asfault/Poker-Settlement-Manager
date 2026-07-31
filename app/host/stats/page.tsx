"use client";

import Card from "@/components/Card";

export default function StatsPage() {
  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-5">Stats</h1>
        <Card className="p-8 text-center">
          <p className="text-white/50 text-sm">
            Lifetime leaderboards arrive in phase 4, once there are saved
            sessions to build them from.
          </p>
        </Card>
      </div>
    </div>
  );
}
