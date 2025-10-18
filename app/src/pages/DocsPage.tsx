const documents = [
  {
    title: "Repository README",
    summary: "High-level overview of the tooling, how to contribute, and the automation expectations.",
    href: "https://github.com/mihailfox/proxmox-openapi#readme",
  },
  {
    title: "Automation Runbook",
    summary: "Step-by-step guide for the Stage sync workflow, manual overrides, and troubleshooting.",
    href: "https://github.com/mihailfox/proxmox-openapi/blob/main/docs/automation.md",
  },
  {
    title: "OpenAPI Releases",
    summary: "Artifacts and release notes produced by the automation pipeline, including JSON/YAML specs.",
    href: "https://github.com/mihailfox/proxmox-openapi/releases",
  },
  {
    title: "Automation Pipeline CLI",
    summary: "Learn how scraping, normalisation, and OpenAPI generation chained together in the CLI pipeline.",
    href: "https://github.com/mihailfox/proxmox-openapi/tree/main/tools/automation",
  },
];

export function DocsPage() {
  return (
    <div className="page page--docs">
      <header className="page-header">
        <h1>Documentation</h1>
        <p>
          Everything you need to operate the Proxmox OpenAPI toolchain—from running the automation pipeline to
          understanding the GitHub Pages deployment.
        </p>
      </header>

      <ul className="doc-list">
        {documents.map((doc) => (
          <li className="doc-card" key={doc.title}>
            <div>
              <h2>{doc.title}</h2>
              <p>{doc.summary}</p>
            </div>
            <a className="button button--ghost" href={doc.href} target="_blank" rel="noreferrer">
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DocsPage;
