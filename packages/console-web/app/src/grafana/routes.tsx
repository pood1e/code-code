import type { Section } from "@code-code/console-web-ui";
import { lazy } from "react";

const GrafanaPage = lazy(() =>
  import("./page").then((module) => ({ default: module.GrafanaPage }))
);

export type GrafanaSectionKey = "grafana";

export type GrafanaSection = Section & { key: GrafanaSectionKey };

export const GRAFANA_SECTION: GrafanaSection = {
  key: "grafana",
  label: "Grafana",
  icon: "layers",
  headline: "Grafana"
};

export const GRAFANA_ROUTES = [
  { path: "grafana", element: <GrafanaPage /> }
];
