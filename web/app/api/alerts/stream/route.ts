import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { gt, desc, asc } from "drizzle-orm";
import { createPollingSSEStream, SSE_BATCH_LIMIT } from "@/lib/sse";

export async function GET() {
  return createPollingSSEStream(
    async (sinceId) => {
      const rows = await db
        .select()
        .from(alerts)
        .where(gt(alerts.id, sinceId))
        .orderBy(asc(alerts.id))
        .limit(SSE_BATCH_LIMIT);
      return rows.map((row) => ({ id: row.id, row }));
    },
    async () => {
      const [latest] = await db.select({ id: alerts.id }).from(alerts).orderBy(desc(alerts.id)).limit(1);
      return latest?.id ?? 0;
    }
  );
}
