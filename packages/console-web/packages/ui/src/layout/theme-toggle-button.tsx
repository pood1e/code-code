import { Box } from "@radix-ui/themes";
import type { ThemeMode } from "./types";

type ThemeToggleButtonProps = {
  theme: ThemeMode;
  collapsed: boolean;
  onToggleTheme: () => void;
};

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function ThemeToggleButton({ theme, collapsed, onToggleTheme }: ThemeToggleButtonProps) {
  return (
    <Box p="3" className="themeToggleSection">
      <button
        aria-label="Toggle theme"
        data-testid="theme-toggle"
        onClick={onToggleTheme}
        className={`navButton ${collapsed ? "navButtonCollapsed" : "navButtonExpanded"}`}
      >
        <Box className="iconWrapper">
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </Box>
        {!collapsed && <Box>{theme === "light" ? "Dark Mode" : "Light Mode"}</Box>}
      </button>
    </Box>
  );
}
