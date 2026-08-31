import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { gt, desc } from "drizzle-orm";
import { createPollingSSEStream } from "@/lib/sse";

export async function GET() {
  return createPollingSSEStream(async (sinceId) => {
    const rows = await db.select().from(alerts).where(gt(alerts.id, sinceId)).orderBy(desc(alerts.id)).limit(50);
    return rows.reverse().map((row) => ({ id: row.id, row }));
  });
}
