/**
 * Minimal Server-Sent-Events helper for this single-instance MVP. Polls SQLite for new rows
 * every POLL_MS and pushes them to the client; production should replace the poll with a real
 * Redis pub/sub subscription fed by the indexer worker (see docs/ARCHITECTURE.md) so many
 * server instances can fan out the same event stream without each one hammering the DB.
 */
const POLL_MS = 2000;

export function createPollingSSEStream<T>(fetchNew: (sinceId: number) => Promise<{ id: number; row: T }[]>) {
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

      // Prime lastId to "now" so we only stream genuinely new rows.
      const initial = await fetchNew(0);
      lastId = initial.reduce((max, r) => Math.max(max, r.id), 0);
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
