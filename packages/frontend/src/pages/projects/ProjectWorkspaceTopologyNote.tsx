type ProjectWorkspaceTopologyNoteProps = {
  workspaceRootPath?: string;
  repoGitUrl?: string;
  docGitUrl?: string | null;
};

export function ProjectWorkspaceTopologyNote({
  workspaceRootPath,
  repoGitUrl,
  docGitUrl
}: ProjectWorkspaceTopologyNoteProps) {
  const rootPath = workspaceRootPath?.trim() || '{workspaceRootPath}';
  const repoGitSource = repoGitUrl?.trim() || '{repoGitUrl}';
  const docsSource = docGitUrl?.trim() || '{docGitUrl | empty}';
  const flowExamplePath = `${rootPath}/flows/{flowType}/{flowRunId}`;
  const governanceCodePath = `${rootPath}/flows/governance/{scopeId}/code`;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
      <p className="text-sm font-medium text-foreground">目录语义</p>
      <div className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Session:</span>{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {`${rootPath}/{sessionId}`}
          </code>
        </p>
        <p>
          <span className="font-medium text-foreground">Flow / Workflow:</span>{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {flowExamplePath}
          </code>
        </p>
        <p>
          Flow 是通用流程运行目录，治理只是其中一种流程类型，不和具体业务名绑定。
        </p>
        <p>
          <span className="font-medium text-foreground">Repo (Git):</span>{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">{repoGitSource}</code>
        </p>
        <p>
          Session 会按需把 repo git 拉到各自运行目录下的{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">code</code> 子目录。
        </p>
        <p>
          Governance 等持续流程会在自己的 flow 目录里维护独立 clone，例如{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {governanceCodePath}
          </code>
          。
        </p>
        <p>
          <span className="font-medium text-foreground">Doc (Git):</span>{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">{docsSource}</code>
        </p>
        <p>
          文档会按需拉取到各自目录下的{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">docs</code> 子目录。
        </p>
      </div>
    </div>
  );
}
