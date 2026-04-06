import { createHash } from 'node:crypto';

import type {
  GovernanceDiscoveredFindingDraft,
  GovernanceTargetRef,
  GovernanceVerificationCheck,
  RepositoryProfile,
  VerificationPlan
} from '@agent-workbench/shared';

import type { RepositoryProfileRecord } from './governance.repository';

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function buildFindingFingerprint(
  scopeId: string,
  finding: GovernanceDiscoveredFindingDraft
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        scopeId,
        source: finding.source,
        title: finding.title.trim().toLowerCase(),
        summary: finding.summary.trim().toLowerCase(),
        categories: [...finding.categories].sort(),
        affectedTargets: [...finding.affectedTargets]
          .map((target) => `${target.kind}:${target.ref}`)
          .sort()
      })
    )
    .digest('hex');
}

export function toRepositoryProfile(
  record: RepositoryProfileRecord
): RepositoryProfile {
  return {
    id: record.id,
    scopeId: record.scopeId,
    branch: record.branch,
    snapshotAt: record.snapshotAt.toISOString(),
    modules: Array.isArray(record.modules)
      ? (record.modules as RepositoryProfile['modules'])
      : [],
    testBaseline:
      record.testBaseline && typeof record.testBaseline === 'object'
        ? ({
            coveragePercent:
              typeof (record.testBaseline as Record<string, unknown>).coveragePercent ===
              'number'
                ? ((record.testBaseline as Record<string, unknown>)
                    .coveragePercent as number)
                : undefined,
            totalTests:
              typeof (record.testBaseline as Record<string, unknown>).totalTests ===
              'number'
                ? ((record.testBaseline as Record<string, unknown>)
                    .totalTests as number)
                : 0,
            failingTests:
              typeof (record.testBaseline as Record<string, unknown>).failingTests ===
              'number'
                ? ((record.testBaseline as Record<string, unknown>)
                    .failingTests as number)
                : 0,
            lastRunAt:
              typeof (record.testBaseline as Record<string, unknown>).lastRunAt ===
              'string'
                ? ((record.testBaseline as Record<string, unknown>)
                    .lastRunAt as string)
                : undefined
          } satisfies RepositoryProfile['testBaseline'])
        : {
            totalTests: 0,
            failingTests: 0
          },
    buildStatus: record.buildStatus,
    metadata:
      record.metadata &&
      typeof record.metadata === 'object' &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function getChangeUnitScope(scope: unknown): {
  targets: GovernanceTargetRef[];
  maxFiles?: number;
  maxDiffLines?: number;
  violationPolicy: string;
} {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    return {
      targets: [],
      violationPolicy: 'warn'
    };
  }

  return {
    targets: getChangeUnitScopeTargets(scope),
    ...(typeof (scope as { maxFiles?: unknown }).maxFiles === 'number'
      ? { maxFiles: (scope as { maxFiles: number }).maxFiles }
      : {}),
    ...(typeof (scope as { maxDiffLines?: unknown }).maxDiffLines === 'number'
      ? { maxDiffLines: (scope as { maxDiffLines: number }).maxDiffLines }
      : {}),
    violationPolicy:
      typeof (scope as { violationPolicy?: unknown }).violationPolicy === 'string'
        ? ((scope as { violationPolicy: string }).violationPolicy as string)
        : 'warn'
  };
}

export function getChangeUnitScopeTargets(scope: unknown): GovernanceTargetRef[] {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    return [];
  }

  const targets = (scope as { targets?: unknown }).targets;
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets.filter(
    (target): target is GovernanceTargetRef =>
      Boolean(target) &&
      typeof target === 'object' &&
      !Array.isArray(target) &&
      isGovernanceTargetKind((target as { kind?: unknown }).kind) &&
      typeof (target as { ref?: unknown }).ref === 'string'
  );
}

export function getVerificationChecks(value: unknown): GovernanceVerificationCheck[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is GovernanceVerificationCheck =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { id?: unknown }).id === 'string' &&
          isVerificationCheckType((item as { type?: unknown }).type) &&
          typeof (item as { required?: unknown }).required === 'boolean'
      )
    : [];
}

export function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function toVerificationPlan(record: {
  id: string;
  subjectType: VerificationPlan['subjectType'];
  changeUnitId: string | null;
  changePlanId: string | null;
  issueId: string | null;
  checks: unknown;
  passCriteria: unknown;
  createdAt: Date;
}): VerificationPlan {
  return {
    id: record.id,
    subjectType: record.subjectType,
    ...(record.changeUnitId ? { changeUnitId: record.changeUnitId } : {}),
    ...(record.changePlanId ? { changePlanId: record.changePlanId } : {}),
    ...(record.issueId ? { issueId: record.issueId } : {}),
    checks: getVerificationChecks(record.checks),
    passCriteria: getStringArray(record.passCriteria),
    createdAt: record.createdAt.toISOString()
  };
}

function isGovernanceTargetKind(
  value: unknown
): value is GovernanceTargetRef['kind'] {
  return (
    value === 'repository' ||
    value === 'module' ||
    value === 'package' ||
    value === 'service' ||
    value === 'file' ||
    value === 'component' ||
    value === 'api' ||
    value === 'screen'
  );
}

function isVerificationCheckType(
  value: unknown
): value is GovernanceVerificationCheck['type'] {
  return (
    value === 'lint' ||
    value === 'typecheck' ||
    value === 'unit_test' ||
    value === 'integration_test' ||
    value === 'e2e_test' ||
    value === 'a11y_check' ||
    value === 'coverage_check' ||
    value === 'static_scan' ||
    value === 'build' ||
    value === 'custom'
  );
}
