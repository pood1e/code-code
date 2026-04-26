import { startTransition, useEffect, useState } from "react";
import type { ThemeMode } from "@code-code/console-web-ui";

const themeStorageKey = "console-web-theme-mode";
const themeChangedEventName = "console-web-theme-changed";

function getStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage;
  if (typeof storage?.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }

  return storage;
}

function getSystemTheme(): ThemeMode {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function getStoredTheme(): ThemeMode | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const value = storage.getItem(themeStorageKey);
  return value === "dark" || value === "light" ? value : null;
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme() || getSystemTheme());

  useEffect(() => {
    const storage = getStorage();
    if (!storage) {
      return;
    }
    storage.setItem(themeStorageKey, theme);
    window.dispatchEvent(new CustomEvent<ThemeMode>(themeChangedEventName, { detail: theme }));
  }, [theme]);

  const toggleTheme = () => {
    startTransition(() => {
      setTheme((current) => (current === "light" ? "dark" : "light"));
    });
  };

  return { theme, toggleTheme };
}

export { themeChangedEventName };

export function useResponsiveSidebarState(isMobile: boolean) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  const toggleSidebar = () => {
    startTransition(() => {
      setSidebarCollapsed((current) => !current);
    });
  };

  return { sidebarCollapsed, toggleSidebar };
}
