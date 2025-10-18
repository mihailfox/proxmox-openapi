import { useTheme } from "../theme/ThemeProvider.tsx";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const icon = mode === "dark" ? "🌙" : "☀️";

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <span className="sr-only">{label}</span>
      <span aria-hidden>{icon}</span>
    </button>
  );
}
