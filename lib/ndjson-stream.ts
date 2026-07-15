type StreamHandler = {
  emit: (payload: unknown) => void;
  aborted: () => boolean;
};

const ndjsonHeaders = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no"
};

function encodeNdjsonEvent(payload: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export function createNdjsonStream(
  handler: (stream: StreamHandler) => Promise<void>,
  options: { signal?: AbortSignal } = {}
) {
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };
      const abort = () => close();
      const emit = (payload: unknown) => {
        if (closed || options.signal?.aborted) return;
        controller.enqueue(encodeNdjsonEvent(payload));
      };
      const aborted = () => closed || Boolean(options.signal?.aborted);

      options.signal?.addEventListener("abort", abort, { once: true });

      try {
        await handler({ emit, aborted });
      } finally {
        options.signal?.removeEventListener("abort", abort);
        close();
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: ndjsonHeaders
  });
}
