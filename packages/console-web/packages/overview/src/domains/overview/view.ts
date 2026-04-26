import { ProviderSurfaceBindingPhase, type CredentialView, type ProviderSurfaceBindingView, type ProviderView } from "@code-code/agent-contract/platform/management/v1";

type OverviewIssueLevel = "red" | "amber";

export type OverviewIssue = {
  level: OverviewIssueLevel;
  title: string;
  reason: string;
  href?: string;
  actionLabel?: string;
};

export type OverviewSummary = {
  total: number;
  ready: number;
  attention: number;
  unknown: number;
  issues: OverviewIssue[];
};

export function summarizeProviderAccounts(accounts: ProviderView[]): OverviewSummary {
  const summary: OverviewSummary = {
    total: accounts.length,
    ready: 0,
    attention: 0,
    unknown: 0,
    issues: [],
  };
  for (const account of accounts) {
    const stats = providerPhaseStats(account.surfaces);
    if (stats.invalid > 0 || stats.error > 0) {
      summary.attention += 1;
      summary.issues.push({
        level: "red",
        title: `Provider · ${account.displayName || account.providerId}`,
        reason: providerIssueReason(account.surfaces, stats.ready),
        href: `/providers?account=${encodeURIComponent(account.providerId)}`,
        actionLabel: "Review Provider",
      });
      continue
    }
    if (stats.refreshing > 0 || stats.stale > 0) {
      summary.attention += 1;
      summary.issues.push({
        level: "amber",
        title: `Provider · ${account.displayName || account.providerId}`,
        reason: providerIssueReason(account.surfaces, stats.ready),
        href: `/providers?account=${encodeURIComponent(account.providerId)}`,
        actionLabel: "Review Provider",
      });
      continue
    }
    if (stats.ready === account.surfaces.length && account.surfaces.length > 0) {
      summary.ready += 1;
      continue
    }
    summary.unknown += 1;
  }
  return summary;
}

export function summarizeCredentials(credentials: CredentialView[]): OverviewSummary {
  const summary: OverviewSummary = {
    total: credentials.length,
    ready: 0,
    attention: 0,
    unknown: 0,
    issues: [],
  };
  for (const credential of credentials) {
    if (credential.status?.materialReady === true) {
      summary.ready += 1;
      continue
    }
    if (credential.status?.materialReady === false) {
      summary.attention += 1;
      summary.issues.push({
        level: "red",
        title: `Credential · ${credential.displayName || credential.credentialId}`,
        reason: credential.status.reason || "Authentication material is not ready.",
        href: `/providers?credential=${encodeURIComponent(credential.credentialId)}`,
        actionLabel: "Review Authentication",
      });
      continue
    }
    summary.unknown += 1;
  }
  return summary;
}

export function collectOverviewIssues(providerSummary: OverviewSummary): OverviewIssue[] {
  return [...providerSummary.issues].sort(compareIssues);
}

function compareIssues(left: OverviewIssue, right: OverviewIssue) {
  if (left.level !== right.level) {
    return left.level === "red" ? -1 : 1;
  }
  return left.title.localeCompare(right.title);
}

function providerIssueReason(instances: ProviderSurfaceBindingView[], readyCount: number) {
  if (instances.length <= 1) {
    return instances[0]?.status?.reason || "Provider endpoint is not fully ready."
  }
  const detail = instances.find((instance) => instance.status?.reason)?.status?.reason
  if (detail) {
    return detail
  }
  return `${readyCount}/${instances.length} endpoints ready`
}

function providerPhaseStats(instances: ProviderSurfaceBindingView[]) {
  const stats = { ready: 0, refreshing: 0, stale: 0, invalid: 0, error: 0, unknown: 0 };
  for (const instance of instances) {
    switch (instance.status?.phase) {
      case ProviderSurfaceBindingPhase.READY:
        stats.ready += 1;
        break;
      case ProviderSurfaceBindingPhase.REFRESHING:
        stats.refreshing += 1;
        break;
      case ProviderSurfaceBindingPhase.STALE:
        stats.stale += 1;
        break;
      case ProviderSurfaceBindingPhase.INVALID_CONFIG:
        stats.invalid += 1;
        break;
      case ProviderSurfaceBindingPhase.ERROR:
        stats.error += 1;
        break;
      default:
        stats.unknown += 1;
        break;
    }
  }
  return stats;
}
