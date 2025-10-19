import { useEffect, useRef, useState } from "react";

interface SwaggerViewerProps {
  specUrl: string;
}

const LARGE_EXAMPLE_THRESHOLD = 4000;

function sanitizeSpecDocument<T>(input: T): T {
  if (!input || typeof input !== "object") {
    return input;
  }

  const clone =
    typeof structuredClone === "function"
      ? structuredClone(input)
      : (JSON.parse(JSON.stringify(input)) as T);

  const queue: unknown[] = [clone];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === "object") {
          queue.push(item);
        }
      }
      continue;
    }

    for (const key of Object.keys(current)) {
      const value = (current as Record<string, unknown>)[key];

      if (key === "example") {
        if (typeof value === "string" && value.length > LARGE_EXAMPLE_THRESHOLD) {
          delete (current as Record<string, unknown>)[key];
          continue;
        }
        if (value && typeof value === "object") {
          const serialized = JSON.stringify(value);
          if (serialized.length > LARGE_EXAMPLE_THRESHOLD) {
            (current as Record<string, unknown>)[key] = {
              note: "Example trimmed for performance",
            };
            continue;
          }
        }
      }

      if (key === "examples" && value && typeof value === "object") {
        delete (current as Record<string, unknown>)[key];
        continue;
      }

      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return clone;
}

export function SwaggerViewer({ specUrl }: SwaggerViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let ui: unknown;
    const controller = new AbortController();

    async function mountSwagger() {
      try {
        setIsLoading(true);
        setError(null);

        const [{ default: SwaggerUIBundle }, response] = await Promise.all([
          import("swagger-ui-dist/swagger-ui-es-bundle"),
          fetch(specUrl, { signal: controller.signal }),
        ]);

        if (!response.ok) {
          throw new Error(`Unable to retrieve schema (status ${response.status})`);
        }

        const spec = await response.json();
        const sanitizedSpec = sanitizeSpecDocument(spec);

        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => resolve());
          } else {
            setTimeout(() => resolve(), 0);
          }
        });

        if (isCancelled || !containerRef.current) {
          return;
        }

        ui = SwaggerUIBundle({
          domNode: containerRef.current,
          spec: sanitizedSpec,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          docExpansion: "none",
          deepLinking: true,
          filter: true,
          defaultModelExpandDepth: 0,
          defaultModelsExpandDepth: -1,
          operationsSorter: "alpha",
          tagsSorter: "alpha",
          tryItOutEnabled: false,
          showCommonExtensions: false,
          onComplete() {
            if (!isCancelled) {
              setIsLoading(false);
              setError(null);
            }
          },
        });

        // Some Swagger UI versions don't invoke onComplete reliably in SPA mounts.
        setTimeout(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }, 0);
      } catch (err) {
        if (!isCancelled && !controller.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setIsLoading(false);
        }
      }
    }

    mountSwagger();

    return () => {
      isCancelled = true;
      controller.abort();
      if (ui && typeof (ui as { destroy?: () => void }).destroy === "function") {
        (ui as { destroy: () => void }).destroy();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [specUrl]);

  if (error) {
    return (
      <div className="swagger-fallback swagger-fallback--error">
        <p>Unable to load the OpenAPI explorer. {error}</p>
        <p>
          Try refreshing the page or downloading the schema directly from the links above.
        </p>
      </div>
    );
  }

  return (
    <div className="swagger-viewer">
      {isLoading && (
        <div className="swagger-fallback">
          <span className="spinner" aria-hidden />
          <p>Loading OpenAPI explorer…</p>
        </div>
      )}
      <div ref={containerRef} className="swagger-ui-host" />
    </div>
  );
}
