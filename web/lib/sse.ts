/**
 * Minimal Server-Sent-Events helper for this single-instance MVP. Polls SQLite for new rows
 * every POLL_MS and pushes them to the client; production should replace the poll with a real
 * Redis pub/sub subscription fed by the indexer worker (see docs/ARCHITECTURE.md) so many
 * server instances can fan out the same event stream without each one hammering the DB.
 */
const POLL_MS = 2000;
const BATCH_LIMIT = 50;

export function createPollingSSEStream<T>(
  /** Returns up to BATCH_LIMIT rows with id > sinceId, oldest first. Must be ascending: a
   *  descending/newest-first batch would let a burst of more than BATCH_LIMIT rows in one poll
   *  window permanently skip everything between sinceId and (newest - BATCH_LIMIT), since the
   *  next poll only ever looks forward from the highest id it has seen. */
  fetchNew: (sinceId: number) => Promise<{ id: number; row: T }[]>,
  /** Returns the current highest id (0 if the table is empty), used only to prime the stream so
   *  a newly-connected client doesn't get flooded with the entire history. */
  getLatestId: () => Promise<number>
) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastId = 0;
      controller.enqueue(encoder.encode(`event: ping\ndata: connected\n\n`));

      const tick = async () => {
        if (closed) return;
        try {
          const rows = await fetchNew(lastId);
          for (const { id, row } of rows) {
            lastId = Math.max(lastId, id);
            controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(row)}\n\n`));
          }
        } catch {
          // transient DB errors shouldn't kill the stream
        }
        if (!closed) setTimeout(tick, POLL_MS);
      };

      lastId = await getLatestId();
      setTimeout(tick, POLL_MS);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const SSE_BATCH_LIMIT = BATCH_LIMIT;
