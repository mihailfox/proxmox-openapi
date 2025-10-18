import { useEffect, useRef, useState } from "react";

interface SwaggerViewerProps {
  specUrl: string;
}

export function SwaggerViewer({ specUrl }: SwaggerViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let ui: unknown;

    async function mountSwagger() {
      try {
        const [{ default: SwaggerUIBundle }] = await Promise.all([
          import("swagger-ui-dist/swagger-ui-es-bundle"),
        ]);

        if (isCancelled || !containerRef.current) {
          return;
        }

        ui = SwaggerUIBundle({
          domNode: containerRef.current,
          url: specUrl,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          docExpansion: "list",
          deepLinking: true,
        });

        if (!isCancelled) {
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setIsLoading(false);
        }
      }
    }

    mountSwagger();

    return () => {
      isCancelled = true;
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
