import { Box, Flex, Tabs } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { AsyncState, NoDataCallout } from "@code-code/console-web-ui";
import { themeChangedEventName } from "../lib/shell-state";
import { useGrafanaAvailability } from "./runtime";

type GrafanaTheme = "light" | "dark";

type GrafanaDashboard = {
  key: string;
  title: string;
  uid: string;
};

const grafanaThemeStorageKey = "console-web-theme-mode";

const dashboards: GrafanaDashboard[] = [
  {
    key: "cluster",
    title: "Cluster Resources",
    uid: "code-code-cluster-resources"
  },
  {
    key: "services",
    title: "Service Health",
    uid: "code-code-platform-services"
  }
];

const pageStyle = {
  height: "100%",
  minHeight: 0,
  backgroundColor: "var(--color-background)"
} as const;

const tabsStyle = {
  height: "100%"
} as const;

const tabsLayoutStyle = {
  height: "100%",
  minHeight: 0
} as const;

const tabsListShellStyle = {
  padding: "var(--space-2) var(--space-3)",
  borderBottom: "1px solid var(--gray-a4)",
  backgroundColor: "var(--color-background)"
} as const;

const tabContentStyle = {
  flex: "1 1 auto",
  minHeight: 0,
  margin: 0,
  padding: 0
} as const;

const frameStyle = {
  border: "0",
  display: "block",
  width: "100%",
  height: "100%",
  minHeight: 0,
  backgroundColor: "var(--color-panel-solid)"
} as const;

function readGrafanaTheme(): GrafanaTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem(grafanaThemeStorageKey) === "dark" ? "dark" : "light";
}

function useGrafanaTheme() {
  const [theme, setTheme] = useState<GrafanaTheme>(() => readGrafanaTheme());

  useEffect(() => {
    const handleThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<GrafanaTheme>).detail;
      setTheme(detail === "dark" ? "dark" : "light");
    };

    window.addEventListener(themeChangedEventName, handleThemeChanged as EventListener);
    return () => {
      window.removeEventListener(themeChangedEventName, handleThemeChanged as EventListener);
    };
  }, []);

  return theme;
}

function resolveDashboardUrl(baseUrl: string, dashboard: GrafanaDashboard, theme: GrafanaTheme) {
  const searchParams = new URLSearchParams({
    from: "now-6h",
    to: "now",
    refresh: "30s",
    kiosk: "true",
    theme,
    timezone: "browser"
  });
  return `${baseUrl}/d/${dashboard.uid}/${dashboard.uid}?${searchParams.toString()}`;
}

export function GrafanaPage() {
  const { appUrl, available, checking } = useGrafanaAvailability();
  const theme = useGrafanaTheme();

  return (
    <AsyncState loading={checking}>
      {available ? (
        <Box style={pageStyle}>
          <Tabs.Root defaultValue={dashboards[0]?.key} style={tabsStyle}>
            <Flex direction="column" style={tabsLayoutStyle}>
              <Box style={tabsListShellStyle}>
                <Tabs.List size="2">
                  {dashboards.map((dashboard) => (
                    <Tabs.Trigger key={dashboard.key} value={dashboard.key}>
                      {dashboard.title}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Box>

              {dashboards.map((dashboard) => (
                <Tabs.Content key={dashboard.key} value={dashboard.key} style={tabContentStyle}>
                  <iframe
                    title={dashboard.title}
                    src={resolveDashboardUrl(appUrl, dashboard, theme)}
                    data-testid="grafana-dashboard-frame"
                    style={frameStyle}
                  />
                </Tabs.Content>
              ))}
            </Flex>
          </Tabs.Root>
        </Box>
      ) : (
        <NoDataCallout size="2">Grafana is not available for this console.</NoDataCallout>
      )}
    </AsyncState>
  );
}
