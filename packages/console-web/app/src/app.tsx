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
import { useMobileViewport } from "./lib/hooks";
import { useResponsiveSidebarState, useThemeMode } from "./lib/shell-state";
import {
  APP_ROUTES,
  buildNavItems,
  resolveNavigationSections,
  resolveSection
} from "./app-composition";
import { ShellRouteOutlet } from "./components/shell-route-outlet";
import { useGrafanaAvailability } from "./grafana/runtime";
import { recordConsoleWebRouteChange } from "./telemetry/runtime";

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeMode();
  const isMobile = useMobileViewport();
  const { sidebarCollapsed, toggleSidebar } = useResponsiveSidebarState(isMobile);
  const { available: grafanaAvailable } = useGrafanaAvailability();
  const navSections = useMemo(
    () => resolveNavigationSections({ grafanaAvailable }),
    [grafanaAvailable]
  );
  const navItems = useMemo(() => buildNavItems(navSections), [navSections]);
  const { activeKey } = resolveSection(location.pathname);
  const contentMode = location.pathname === "/grafana" ? "fullBleed" : "default";

  useEffect(() => {
    recordConsoleWebRouteChange(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <ConsoleShellLayout
      activeNavKey={activeKey}
      brand="Code Code"
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

export function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate replace to="/overview" />} />
          {APP_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  );
}
