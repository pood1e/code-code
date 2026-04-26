import { lazy } from "react";
import type { Section } from "@code-code/console-web-ui";

const NetworkPage = lazy(() =>
  import("./network-page").then((module) => ({ default: module.NetworkPage }))
);

export type NetworkSectionKey = "network";

export type NetworkSection = Section & { key: NetworkSectionKey };

export const NETWORK_SECTION: NetworkSection = {
  key: "network",
  label: "Network",
  icon: "shield",
  headline: "Network"
};

export const NETWORK_SECTIONS: NetworkSection[] = [NETWORK_SECTION];

export const NETWORK_ROUTES = [
  { path: "network", element: <NetworkPage /> }
];
