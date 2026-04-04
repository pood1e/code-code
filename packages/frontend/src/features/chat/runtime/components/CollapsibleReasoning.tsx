import React, { memo } from 'react';
import { Brain } from 'lucide-react';

import { MarkdownRenderer } from './MarkdownRenderer';
import { InlineCollapsibleBlock } from './InlineCollapsibleBlock';

interface CollapsibleReasoningProps {
  text: string;
}

export const CollapsibleReasoning = memo(function CollapsibleReasoning({
  text
}: CollapsibleReasoningProps) {
  return (
    <InlineCollapsibleBlock
      expandedLabel="思考过程"
      summary="Thinking"
      icon={<Brain className="h-3.5 w-3.5 shrink-0" />}
      widthClassName="mb-2 max-w-[min(46rem,100%)]"
      bodyClassName="mb-2"
    >
      <MarkdownRenderer
        content={text}
        density="compact"
        collapsibleBlocks
        className="text-[12px] opacity-70 prose-p:leading-relaxed prose-sm dark:prose-invert max-w-none"
      />
    </InlineCollapsibleBlock>
  );
});
