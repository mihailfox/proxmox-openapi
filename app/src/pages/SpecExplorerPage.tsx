import { useMemo, useState } from "react";
import { SwaggerViewer } from "../components/SwaggerViewer.tsx";

const DEFAULT_SPEC_PATH = "openapi/proxmox-ve.json";

function resolveSpecUrl() {
  const configured = import.meta.env.VITE_OPENAPI_URL as string | undefined;
  if (configured && /^(https?:)?\/\//.test(configured)) {
    return configured;
  }

  if (configured?.startsWith("/")) {
    return configured;
  }

  const base = import.meta.env.BASE_URL ?? "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const candidate = configured && configured.trim().length > 0 ? configured.trim() : DEFAULT_SPEC_PATH;
  const sanitized = candidate.replace(/^\.\//, "");
  return `${normalizedBase}${sanitized}`;
}

export function SpecExplorerPage() {
  const specUrl = useMemo(resolveSpecUrl, []);
  const [isExplorerVisible, setExplorerVisible] = useState(false);

  const yamlUrl = useMemo(() => specUrl.replace(/\.json(\?.*)?$/i, ".yaml$1"), [specUrl]);

  const handleLoadExplorer = () => {
    setExplorerVisible(true);
  };

  return (
    <div className="page page--explorer">
      <header className="page-header">
        <h1>API Explorer</h1>
        <p>
          Inspect every Proxmox VE endpoint, parameters, and schema definition. Use the built-in search to jump straight
          to the resources you care about.
        </p>
      </header>
      <div className="explorer-actions">
        <button type="button" className="button button--primary" onClick={handleLoadExplorer} disabled={isExplorerVisible}>
          {isExplorerVisible ? "Explorer Loaded" : "Load API Explorer"}
        </button>
        <nav className="explorer-downloads" aria-label="Schema downloads">
          <a className="button button--ghost" href={specUrl} target="_blank" rel="noreferrer">
            Download JSON
          </a>
          <a className="button button--ghost" href={yamlUrl} target="_blank" rel="noreferrer">
            Download YAML
          </a>
        </nav>
      </div>
      {isExplorerVisible ? (
        <div className="swagger-container" id="swagger">
          <SwaggerViewer specUrl={specUrl} />
        </div>
      ) : (
        <div className="swagger-placeholder">
          <p>The explorer loads on demand so the page stays fast. Click the button above to initialise Swagger UI.</p>
        </div>
      )}
    </div>
  );
}

export default SpecExplorerPage;
