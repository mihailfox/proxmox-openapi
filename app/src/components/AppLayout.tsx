import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.tsx";

const navLinks = [
  { to: ".", label: "Overview", end: true },
  { to: "explorer", label: "API Explorer" },
  { to: "docs", label: "Docs" },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__content">
          <div className="brand">
            <span className="brand__dot" aria-hidden />
            <span className="brand__title">Proxmox OpenAPI</span>
          </div>
          <div className="app-header__actions">
            <nav aria-label="Main navigation" className="app-nav">
              {navLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => (isActive ? "app-nav__link app-nav__link--active" : "app-nav__link")}
                >
                  {label}
                </NavLink>
              ))}
              <a
                className="app-nav__link app-nav__link--external"
                href="https://github.com/mihailfox/proxmox-openapi"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>
          Built with ❤️ for the Proxmox community. Read the{" "}
          <a href="https://github.com/mihailfox/proxmox-openapi#readme" target="_blank" rel="noreferrer">
            contributor guide
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
