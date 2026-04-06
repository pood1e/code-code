import { FileCode2, FileText, Braces } from 'lucide-react';

import type { PipelineArtifactSummary } from '@agent-workbench/shared';

import { getPipelineArtifactContentUrl } from '@/api/pipelines';

type Props = {
  pipelineId: string;
  artifacts: PipelineArtifactSummary[];
};

function ArtifactIcon({ contentType }: { contentType: string }) {
  if (contentType === 'application/json')
    return <Braces className="h-4 w-4 text-blue-500" />;
  if (contentType === 'text/markdown' || contentType === 'text/plain')
    return <FileText className="h-4 w-4 text-indigo-500" />;
  return <FileCode2 className="h-4 w-4 text-muted-foreground" />;
}

export function ArtifactList({ pipelineId, artifacts }: Props) {
  if (artifacts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        尚无产出物
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {artifacts.map((artifact) => (
        <li key={artifact.id}>
          <a
            id={`artifact-link-${artifact.id}`}
            href={getPipelineArtifactContentUrl(pipelineId, artifact.id)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArtifactIcon contentType={artifact.contentType} />
            <span className="flex-1 min-w-0 truncate font-mono text-xs">
              {artifact.name}
            </span>
            {artifact.metadata && (
              <span className="text-[11px] text-muted-foreground shrink-0">
                A{artifact.metadata.attempt} · v{artifact.metadata.version}
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {artifact.contentType.split('/')[1]}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
