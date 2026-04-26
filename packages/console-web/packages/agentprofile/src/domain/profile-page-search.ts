import type { SetURLSearchParams } from "react-router-dom";

const profileRootTabs = ["profiles", "mcps", "skills", "rules"] as const;

export type ProfileRootTab = (typeof profileRootTabs)[number];

export function readProfileRootTab(searchParams: URLSearchParams): ProfileRootTab {
  const tab = searchParams.get("tab");
  return resolveProfileRootTab(tab);
}

export function writeProfileRootTab(
  value: string,
  setSearchParams: SetURLSearchParams,
) {
  const nextTab = resolveProfileRootTab(value);
  setSearchParams(nextTab === "profiles" ? {} : { tab: nextTab }, { replace: true });
}

function resolveProfileRootTab(value: string | null): ProfileRootTab {
  return value !== null && profileRootTabs.includes(value as ProfileRootTab)
    ? (value as ProfileRootTab)
    : "profiles";
}
