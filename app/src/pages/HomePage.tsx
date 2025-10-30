import { useId } from "react";
import { Link } from "react-router-dom";

const featureHighlights = [
  {
    title: "Terraform-ready foundation",
    body: "OpenAPI bundles power third-party automation, starting with the roadmap to a full Terraform provider for Proxmox VE.",
  },
  {
    title: "Unified CLI & pipeline",
    body: "The @mihailfox/proxmox-openapi package now handles scraping, normalization, generation, and automation from a single command.",
  },
  {
    title: "Spec explorer",
    body: "Dive into every endpoint using the embedded Swagger UI experience optimised for quick search and filtering.",
  },
];

export function HomePage() {
  const featureHeadingId = useId();
  const ctaHeadingId = useId();

  return (
    <div className="page page--home">
      <section className="hero">
        <p className="hero__eyebrow">Proxmox tooling</p>
        <h1 className="hero__title">Unified OpenAPI specs & documentation</h1>
        <p className="hero__subtitle">
          Generate, explore, and ship Proxmox VE OpenAPI definitions. Everything here is focused on enabling third-party
          tooling—starting with the building blocks for a Terraform provider—and the automation runbooks that keep
          artifacts in sync.
        </p>
        <div className="hero__actions">
          <Link className="button button--primary" to="explorer">
            Open API Explorer
          </Link>
          <Link className="button" to="docs">
            Browse docs
          </Link>
        </div>
      </section>

      <section className="feature-grid" aria-labelledby={featureHeadingId}>
        <h2 id={featureHeadingId}>What you get</h2>
        <div className="feature-grid__items">
          {featureHighlights.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta" aria-labelledby={ctaHeadingId}>
        <div className="cta__content">
          <h2 id={ctaHeadingId}>Ready to contribute?</h2>
          <p>
            Start by reading the contributor guide, then open a pull request linked to the relevant issue. Automation will
            guide you the rest of the way.
          </p>
        </div>
        <a
          className="button button--ghost"
          href="https://github.com/mihailfox/proxmox-openapi#readme"
          target="_blank"
          rel="noreferrer"
        >
          View README
        </a>
      </section>
    </div>
  );
}

export default HomePage;
