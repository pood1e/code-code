import { lazy } from "react";

const OverviewPage = lazy(() =>
  import("./pages/overview").then((m) => ({ default: m.OverviewPage }))
);

export const OVERVIEW_ROUTES = [
  { path: "overview", element: <OverviewPage /> },
];
