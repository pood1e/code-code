import { lazy } from "react";

const ProfilesPage = lazy(() =>
  import("./pages/profiles").then((m) => ({ default: m.ProfilesPage }))
);

export const AGENT_PROFILE_ROUTES = [
  { path: "profiles", element: <ProfilesPage /> }
];
