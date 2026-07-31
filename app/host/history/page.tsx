"use client";

import Card from "@/components/Card";

export default function HistoryPage() {
  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-5">History</h1>
        <Card className="p-8 text-center">
          <p className="text-white/50 text-sm">
            Session history arrives in phase 4, once sessions are saving to the
            database.
          </p>
        </Card>
      </div>
    </div>
  );
}
