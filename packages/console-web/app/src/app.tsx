import { startTransition, useEffect, useMemo } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ConsoleShellLayout } from "@code-code/console-web-ui";
import type { Section } from "@code-code/console-web-ui";
import { useMobileViewport } from "./lib/hooks";
import { useResponsiveSidebarState, useThemeMode } from "./lib/shell-state";
import {
  APP_ROUTES,
  type AppRoute,
  buildNavItems,
  resolveNavigationSections,
  resolveSection
} from "./app-composition";
import { ShellRouteOutlet } from "./components/shell-route-outlet";
import { useGrafanaAvailability } from "./grafana/runtime";
import { recordConsoleWebRouteChange } from "./telemetry/runtime";

export type AppConfig = {
  /** Override sidebar sections. Defaults to full console sections. */
  sections?: Section[];
  /** Override routes. Defaults to full console routes. */
  routes?: AppRoute[];
  /** Override brand text. Defaults to "Code Code". */
  brand?: string;
  /** Override default route. Defaults to "/overview". */
  defaultRoute?: string;
};

function AppShell({
  sections,
  brand = "Code Code",
}: {
  sections: Section[];
  brand: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeMode();
  const isMobile = useMobileViewport();
  const { sidebarCollapsed, toggleSidebar } = useResponsiveSidebarState(isMobile);
  const navItems = useMemo(() => buildNavItems(sections), [sections]);
  const fallbackSection = sections[0];
  const { activeKey } = resolveSection(location.pathname, fallbackSection);
  const contentMode = location.pathname === "/grafana" ? "fullBleed" : "default";

  useEffect(() => {
    recordConsoleWebRouteChange(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <ConsoleShellLayout
      activeNavKey={activeKey}
      brand={brand}
      contentMode={contentMode}
      navItems={navItems}
      onSelectNav={(key) => {
        startTransition(() => {
          navigate(`/${key}`);
        });
      }}
      onToggleSidebar={toggleSidebar}
      sidebarCollapsed={sidebarCollapsed}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      <ShellRouteOutlet />
    </ConsoleShellLayout>
  );
}

export function App({ sections, routes, brand, defaultRoute }: AppConfig = {}) {
  const { available: grafanaAvailable } = useGrafanaAvailability();
  const resolvedSections = useMemo(
    () => sections ?? resolveNavigationSections({ grafanaAvailable }),
    [sections, grafanaAvailable]
  );
  const resolvedRoutes = routes ?? APP_ROUTES;
  const resolvedDefaultRoute = defaultRoute ?? "/overview";
  const resolvedBrand = brand ?? "Code Code";

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<AppShell sections={resolvedSections} brand={resolvedBrand} />}>
          <Route index element={<Navigate replace to={resolvedDefaultRoute} />} />
          {resolvedRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  );
}
