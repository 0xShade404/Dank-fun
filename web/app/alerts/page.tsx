import { getRecentAlerts } from "@/lib/db/queries";
import { AlertFeed } from "@/components/alerts/alert-feed";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getRecentAlerts(50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black text-neutral-50">Sniper Alerts</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Live, event-driven activity: launches, first buys, whale trades, rapid volume, and graduations. Not
        investment advice — just what&apos;s happening on-chain.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
        <AlertFeed initialAlerts={alerts} />
      </div>
    </div>
  );
}
